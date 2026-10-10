import { getActiveCompanyId } from "../lib/activeCompany";
import { driverApplicationCompletion, parseDriverApplicationForm } from "../lib/driver-application-form";
import { uploadChatAttachment } from "./chatAttachments";
import { supabase } from "../lib/supabase";
import type { DriverApplicationDocument, DriverApplicationFormData } from "../types/driver-application-form";

export type DriverApplicationStatus = "draft" | "in_progress" | "submitted" | "reviewed" | "archived";

export type DriverApplicationRow = {
  id: string;
  invite_token: string;
  listing_id: number | null;
  deal_id: string | null;
  submission_id: string | null;
  recruiter_company_id: string;
  carrier_company_id: string | null;
  driver_email: string | null;
  driver_phone: string | null;
  driver_first_name: string | null;
  driver_last_name: string | null;
  form_data: Record<string, unknown>;
  documents: unknown;
  completion_pct: number;
  status: DriverApplicationStatus;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
};

function appId(): string {
  return `APP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export function parseApplicationDocuments(raw: unknown): DriverApplicationDocument[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((d) => d && typeof d === "object")
    .map((d) => {
      const doc = d as Record<string, string>;
      return {
        id: doc.id ?? crypto.randomUUID(),
        label: doc.label ?? "Document",
        fileName: doc.fileName ?? doc.file_name ?? "",
        storagePath: doc.storagePath ?? doc.storage_path ?? "",
        uploadedAt: doc.uploadedAt ?? doc.uploaded_at ?? ""
      };
    });
}

export async function createDriverApplicationInvite(params: {
  listingId?: number;
  dealId?: string;
  submissionId?: string;
  carrierCompanyId?: string;
}): Promise<{ id: string; inviteToken: string }> {
  if (!supabase) throw new Error("Supabase not configured");
  const id = appId();
  const { data, error } = await supabase
    .from("driver_applications")
    .insert({
      id,
      listing_id: params.listingId ?? null,
      deal_id: params.dealId ?? null,
      submission_id: params.submissionId ?? null,
      carrier_company_id: params.carrierCompanyId ?? null,
      recruiter_company_id: getActiveCompanyId(),
      status: "draft"
    })
    .select("id, invite_token")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id, inviteToken: data.invite_token };
}

export async function fetchDriverApplicationByToken(token: string): Promise<DriverApplicationRow | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("driver_applications")
    .select("*")
    .eq("invite_token", token)
    .maybeSingle();
  if (error) throw error;
  return data as DriverApplicationRow | null;
}

export async function fetchDriverApplicationById(id: string): Promise<DriverApplicationRow | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("driver_applications")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as DriverApplicationRow | null;
}

export async function updateDriverApplicationForm(
  id: string,
  patch: Partial<
    Pick<
      DriverApplicationRow,
      | "form_data"
      | "documents"
      | "completion_pct"
      | "status"
      | "driver_email"
      | "driver_phone"
      | "driver_first_name"
      | "driver_last_name"
      | "submitted_at"
    >
  >
): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase
    .from("driver_applications")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function saveDriverApplicationProgress(params: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  formData: DriverApplicationFormData;
  documents: DriverApplicationDocument[];
  submit?: boolean;
}): Promise<void> {
  const form = parseDriverApplicationForm(params.formData);
  const hasIdentity = Boolean(params.firstName.trim() && params.lastName.trim() && params.email.trim() && params.phone.trim());
  const { percent } = driverApplicationCompletion(form, params.documents.length, hasIdentity);
  await updateDriverApplicationForm(params.id, {
    driver_first_name: params.firstName.trim(),
    driver_last_name: params.lastName.trim(),
    driver_email: params.email.trim(),
    driver_phone: params.phone.trim(),
    form_data: params.formData as Record<string, unknown>,
    documents: params.documents,
    completion_pct: percent,
    status: params.submit ? "submitted" : percent > 0 ? "in_progress" : "draft",
    submitted_at: params.submit ? new Date().toISOString() : null
  });
}

export async function uploadDriverApplicationDocument(
  applicationId: string,
  file: File,
  label: string,
  existing: DriverApplicationDocument[]
): Promise<DriverApplicationDocument[]> {
  const uploaded = await uploadChatAttachment(file, `driver-applications/${applicationId}`);
  const doc: DriverApplicationDocument = {
    id: crypto.randomUUID(),
    label,
    fileName: uploaded.name,
    storagePath: uploaded.path,
    uploadedAt: new Date().toISOString()
  };
  const documents = [...existing, doc];
  await updateDriverApplicationForm(applicationId, { documents });
  return documents;
}

export async function fetchRecruiterDriverApplications(): Promise<DriverApplicationRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("driver_applications")
    .select("*")
    .eq("recruiter_company_id", getActiveCompanyId())
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DriverApplicationRow[];
}

export async function fetchCarrierDriverApplications(): Promise<DriverApplicationRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("driver_applications")
    .select("*")
    .eq("carrier_company_id", getActiveCompanyId())
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DriverApplicationRow[];
}

export async function fetchDriverApplicationsForContext(params: {
  dealId?: string;
  submissionId?: string;
  listingId?: number;
}): Promise<DriverApplicationRow[]> {
  if (!supabase) return [];
  let query = supabase.from("driver_applications").select("*").order("updated_at", { ascending: false });
  if (params.dealId) query = query.eq("deal_id", params.dealId);
  else if (params.submissionId) query = query.eq("submission_id", params.submissionId);
  else if (params.listingId != null) query = query.eq("listing_id", params.listingId);
  else return [];
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as DriverApplicationRow[];
}

export async function fetchMyDriverApplications(role: "recruiter" | "carrier"): Promise<DriverApplicationRow[]> {
  return role === "carrier" ? fetchCarrierDriverApplications() : fetchRecruiterDriverApplications();
}

export function driverApplicationInviteUrl(token: string): string {
  if (typeof window !== "undefined") return `${window.location.origin}/apply/${token}`;
  return `/apply/${token}`;
}
