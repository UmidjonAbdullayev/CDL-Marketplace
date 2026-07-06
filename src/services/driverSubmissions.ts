import { getActiveCompanyId } from "../lib/activeCompany";
import {
  CARRIER_UPDATABLE_STATUSES,
  type DriverSubmissionStatus
} from "../lib/driver-submissions";
import { supabase } from "../lib/supabase";
import type { Paginated } from "../types";
import { DEFAULT_PAGE_SIZE } from "./marketplace";
import {
  fetchDealMessages,
  sendDealMessage,
  subscribeDealMessages,
  type DealMessageRow
} from "./hiring";

export type DriverSubmissionRow = {
  id: string;
  listing_id: number;
  recruiter_company_id: string;
  carrier_company_id: string;
  status: string;
  status_comment: string | null;
  created_at: string;
  updated_at: string;
};

export type DriverSubmissionListItem = DriverSubmissionRow & {
  driver_first_name: string;
  driver_last_name: string;
  driver_state: string;
  driver_equipment: string;
  carrier_name: string;
  recruiter_name: string;
};

export type DriverSubmissionEvent = {
  id: string;
  submission_id: string;
  status: string;
  comment: string | null;
  updated_by_company_id: string | null;
  created_at: string;
};

export type SubmissionWorkspace = {
  submission: DriverSubmissionRow;
  driver: {
    id: number;
    first_name: string;
    last_name: string;
    state: string;
    equipment: string;
    driver_type: string;
    cdl_class: string;
    years_exp: number;
    desired_weekly_pay: string | null;
    weeks_out_preference: string | null;
    company_expectations: string | null;
  } | null;
  carrierName: string;
  recruiterName: string;
  events: DriverSubmissionEvent[];
  conversationId: string | null;
};

export type SendableListing = {
  id: number;
  label: string;
  state: string;
  equipment: string;
  driver_type: string;
  desired_weekly_pay: string | null;
};

function submissionId(): string {
  return `SUB-${Date.now().toString().slice(-8)}`;
}

function toPaginated<T>(items: T[], total: number, page: number, pageSize: number): Paginated<T> {
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  };
}

async function findCarrierRecruiterConversation(
  carrierCompanyId: string,
  recruiterCompanyId: string,
  submissionIdValue?: string | null
): Promise<string | null> {
  if (!supabase) return null;
  let query = supabase
    .from("conversations")
    .select("id")
    .eq("buyer_company_id", carrierCompanyId)
    .eq("seller_company_id", recruiterCompanyId)
    .eq("channel_type", "carrier_recruiter");

  if (submissionIdValue) {
    query = query.eq("submission_id", submissionIdValue);
  } else {
    query = query.is("submission_id", null);
  }

  const { data, error } = await query.order("created_at", { ascending: true }).limit(1);
  if (error) throw error;
  return data?.[0]?.id ?? null;
}

export async function ensureInquiryConversation(
  carrierCompanyId: string,
  recruiterCompanyId: string
): Promise<string | null> {
  if (!supabase) return null;
  const existing = await findCarrierRecruiterConversation(carrierCompanyId, recruiterCompanyId, null);
  if (existing) return existing;

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      buyer_company_id: carrierCompanyId,
      seller_company_id: recruiterCompanyId,
      channel_type: "carrier_recruiter",
      subject: "Carrier inquiry",
      is_support: false
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function ensureSubmissionConversation(
  submissionIdValue: string,
  carrierCompanyId: string,
  recruiterCompanyId: string
): Promise<string | null> {
  if (!supabase) return null;
  const existing = await findCarrierRecruiterConversation(
    carrierCompanyId,
    recruiterCompanyId,
    submissionIdValue
  );
  if (existing) return existing;

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      buyer_company_id: carrierCompanyId,
      seller_company_id: recruiterCompanyId,
      channel_type: "carrier_recruiter",
      submission_id: submissionIdValue,
      subject: "Driver submission",
      is_support: false
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function fetchRecruiterSendableListings(): Promise<SendableListing[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("driver_listings")
    .select("id, first_name, last_name, state, equipment, driver_type, desired_weekly_pay")
    .eq("seller_company_id", getActiveCompanyId())
    .eq("status", "active")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    label: `${row.first_name} ${row.last_name.charAt(0)}. · ${row.equipment} · ${row.state}`,
    state: row.state,
    equipment: row.equipment,
    driver_type: row.driver_type,
    desired_weekly_pay: row.desired_weekly_pay
  }));
}

export async function sendDriverToCarrier(
  listingId: number,
  carrierCompanyId: string
): Promise<{ submissionId: string; conversationId: string | null }> {
  if (!supabase) throw new Error("Supabase not configured");
  const recruiterCompanyId = getActiveCompanyId();
  const id = submissionId();
  const now = new Date().toISOString();

  const { error } = await supabase.from("driver_submissions").insert({
    id,
    listing_id: listingId,
    recruiter_company_id: recruiterCompanyId,
    carrier_company_id: carrierCompanyId,
    status: "opened",
    updated_at: now
  });
  if (error) {
    if (error.code === "23505") throw new Error("This driver was already sent to this carrier.");
    throw error;
  }

  await supabase.from("driver_submission_events").insert({
    submission_id: id,
    status: "opened",
    comment: "Driver profile sent to carrier",
    updated_by_company_id: recruiterCompanyId
  });

  const conversationId = await ensureSubmissionConversation(id, carrierCompanyId, recruiterCompanyId);
  if (conversationId) {
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_company_id: recruiterCompanyId,
      direction: "out",
      body: "Driver profile submitted for your review. Please update the hiring status as you progress."
    });
    await supabase.from("conversations").update({ last_message_at: now }).eq("id", conversationId);
  }

  return { submissionId: id, conversationId };
}

export async function fetchRecruiterSubmissionsPage(
  { page = 1, pageSize = DEFAULT_PAGE_SIZE }: { page?: number; pageSize?: number } = {}
): Promise<Paginated<DriverSubmissionListItem>> {
  if (!supabase) return toPaginated([], 0, page, pageSize);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const recruiterId = getActiveCompanyId();

  const { data, error, count } = await supabase
    .from("driver_submissions")
    .select(
      `id, listing_id, recruiter_company_id, carrier_company_id, status, status_comment, created_at, updated_at,
      driver_listings ( first_name, last_name, state, equipment ),
      carrier:companies!driver_submissions_carrier_company_id_fkey ( name )`,
      { count: "exact" }
    )
    .eq("recruiter_company_id", recruiterId)
    .order("updated_at", { ascending: false })
    .range(from, to);
  if (error) throw error;

  const items: DriverSubmissionListItem[] = (data ?? []).map((row) => {
    const listing = Array.isArray(row.driver_listings) ? row.driver_listings[0] : row.driver_listings;
    const carrier = Array.isArray(row.carrier) ? row.carrier[0] : row.carrier;
    return {
      id: row.id,
      listing_id: row.listing_id,
      recruiter_company_id: row.recruiter_company_id,
      carrier_company_id: row.carrier_company_id,
      status: row.status,
      status_comment: row.status_comment,
      created_at: row.created_at,
      updated_at: row.updated_at,
      driver_first_name: listing?.first_name ?? "",
      driver_last_name: listing?.last_name ?? "",
      driver_state: listing?.state ?? "",
      driver_equipment: listing?.equipment ?? "",
      carrier_name: carrier?.name ?? "Carrier",
      recruiter_name: ""
    };
  });

  return toPaginated(items, count ?? 0, page, pageSize);
}

export async function fetchCarrierSubmissionsPage(
  { page = 1, pageSize = DEFAULT_PAGE_SIZE }: { page?: number; pageSize?: number } = {}
): Promise<Paginated<DriverSubmissionListItem>> {
  if (!supabase) return toPaginated([], 0, page, pageSize);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const carrierId = getActiveCompanyId();

  const { data, error, count } = await supabase
    .from("driver_submissions")
    .select(
      `id, listing_id, recruiter_company_id, carrier_company_id, status, status_comment, created_at, updated_at,
      driver_listings ( first_name, last_name, state, equipment ),
      recruiter:companies!driver_submissions_recruiter_company_id_fkey ( name )`,
      { count: "exact" }
    )
    .eq("carrier_company_id", carrierId)
    .order("updated_at", { ascending: false })
    .range(from, to);
  if (error) throw error;

  const items: DriverSubmissionListItem[] = (data ?? []).map((row) => {
    const listing = Array.isArray(row.driver_listings) ? row.driver_listings[0] : row.driver_listings;
    const recruiter = Array.isArray(row.recruiter) ? row.recruiter[0] : row.recruiter;
    return {
      id: row.id,
      listing_id: row.listing_id,
      recruiter_company_id: row.recruiter_company_id,
      carrier_company_id: row.carrier_company_id,
      status: row.status,
      status_comment: row.status_comment,
      created_at: row.created_at,
      updated_at: row.updated_at,
      driver_first_name: listing?.first_name ?? "",
      driver_last_name: listing?.last_name ?? "",
      driver_state: listing?.state ?? "",
      driver_equipment: listing?.equipment ?? "",
      carrier_name: "",
      recruiter_name: recruiter?.name ?? "Recruiter"
    };
  });

  return toPaginated(items, count ?? 0, page, pageSize);
}

export async function fetchSubmissionWorkspace(submissionIdValue: string): Promise<SubmissionWorkspace | null> {
  if (!supabase) return null;

  const { data: submission, error } = await supabase
    .from("driver_submissions")
    .select("*")
    .eq("id", submissionIdValue)
    .maybeSingle();
  if (error) throw error;
  if (!submission) return null;

  const [{ data: listing }, { data: companies }, { data: events }] = await Promise.all([
    supabase
      .from("driver_listings")
      .select(
        "id, first_name, last_name, state, equipment, driver_type, cdl_class, years_exp, desired_weekly_pay, weeks_out_preference, company_expectations"
      )
      .eq("id", submission.listing_id)
      .maybeSingle(),
    supabase
      .from("companies")
      .select("id, name")
      .in("id", [submission.carrier_company_id, submission.recruiter_company_id]),
    supabase
      .from("driver_submission_events")
      .select("*")
      .eq("submission_id", submissionIdValue)
      .order("created_at", { ascending: true })
  ]);

  const companyMap = new Map((companies ?? []).map((c) => [c.id, c.name]));
  const conversationId = await ensureSubmissionConversation(
    submissionIdValue,
    submission.carrier_company_id,
    submission.recruiter_company_id
  );

  return {
    submission: submission as DriverSubmissionRow,
    driver: listing ?? null,
    carrierName: companyMap.get(submission.carrier_company_id) ?? "Carrier",
    recruiterName: companyMap.get(submission.recruiter_company_id) ?? "Recruiter",
    events: (events ?? []) as DriverSubmissionEvent[],
    conversationId
  };
}

export async function updateSubmissionStatus(
  submissionIdValue: string,
  status: DriverSubmissionStatus,
  comment: string,
  actorCompanyId: string
): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const now = new Date().toISOString();

  const { error: updErr } = await supabase
    .from("driver_submissions")
    .update({ status, status_comment: comment.trim() || null, updated_at: now })
    .eq("id", submissionIdValue);
  if (updErr) throw updErr;

  const { error: evtErr } = await supabase.from("driver_submission_events").insert({
    submission_id: submissionIdValue,
    status,
    comment: comment.trim() || null,
    updated_by_company_id: actorCompanyId
  });
  if (evtErr) throw evtErr;

  const { data: sub } = await supabase
    .from("driver_submissions")
    .select("carrier_company_id, recruiter_company_id")
    .eq("id", submissionIdValue)
    .single();
  if (!sub) return;

  const convId = await ensureSubmissionConversation(
    submissionIdValue,
    sub.carrier_company_id,
    sub.recruiter_company_id
  );
  if (convId) {
    await supabase.from("messages").insert({
      conversation_id: convId,
      sender_company_id: actorCompanyId,
      direction: actorCompanyId === sub.carrier_company_id ? "in" : "out",
      body: `Status updated to ${status.replace(/_/g, " ")}${comment.trim() ? `: ${comment.trim()}` : ""}`
    });
    await supabase.from("conversations").update({ last_message_at: now }).eq("id", convId);
  }
}

export function canCarrierUpdateStatus(status: string): boolean {
  return CARRIER_UPDATABLE_STATUSES.includes(status as DriverSubmissionStatus);
}

export {
  fetchDealMessages as fetchSubmissionMessages,
  sendDealMessage as sendSubmissionMessage,
  subscribeDealMessages as subscribeSubmissionMessages,
  type DealMessageRow as SubmissionMessageRow
};

export function subscribeSubmissionWorkspace(submissionIdValue: string, onChange: () => void): () => void {
  if (!supabase) return () => {};
  const client = supabase;
  const channel = client
    .channel(`submission-workspace-${submissionIdValue}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "driver_submissions", filter: `id=eq.${submissionIdValue}` },
      () => onChange()
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "driver_submission_events",
        filter: `submission_id=eq.${submissionIdValue}`
      },
      () => onChange()
    )
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}

export async function fetchExistingSubmission(
  listingId: number,
  carrierCompanyId: string
): Promise<DriverSubmissionRow | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("driver_submissions")
    .select("*")
    .eq("listing_id", listingId)
    .eq("carrier_company_id", carrierCompanyId)
    .maybeSingle();
  if (error) throw error;
  return (data as DriverSubmissionRow) ?? null;
}
