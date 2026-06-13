import { supabase } from "../lib/supabase";
import type {
  AccountType,
  CarrierPlanId,
  RegistrationAccount,
  RegistrationPayload,
  RegistrationStatus
} from "../types/registration";

async function hashPassword(password: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function resolveStatus(accountType: AccountType, plan?: CarrierPlanId): RegistrationStatus {
  if (accountType === "carrier") {
    if (!plan || plan === "free") return "active_preview";
    return "pending_payment";
  }
  return "pending_review";
}

function resolveEmail(payload: RegistrationPayload): string {
  if (payload.accountType === "solo_recruiter") {
    return (payload.profile as { email: string }).email;
  }
  return (payload.profile as { companyEmail: string }).companyEmail;
}

export async function submitRegistration(
  payload: RegistrationPayload,
  audit: { ip?: string; userAgent?: string }
): Promise<{ id: string; status: RegistrationStatus }> {
  if (!supabase) {
    const id = crypto.randomUUID();
    return { id, status: resolveStatus(payload.accountType, payload.selectedPlan) };
  }

  const password_hash = await hashPassword(payload.password);
  const status = resolveStatus(payload.accountType, payload.selectedPlan);
  const email = resolveEmail(payload);

  const { data, error } = await supabase
    .from("registration_accounts")
    .insert({
      account_type: payload.accountType,
      status,
      selected_plan: payload.accountType === "carrier" ? payload.selectedPlan ?? "free" : null,
      email,
      password_hash,
      profile_data: payload.profile,
      policy_accepted: payload.policyAccepted,
      policy_accepted_at: new Date().toISOString(),
      policy_version: payload.policyVersion,
      accepted_ip_address: audit.ip ?? null,
      accepted_user_agent: audit.userAgent ?? null
    })
    .select("id, status")
    .single();

  if (error) throw error;
  return { id: data.id, status: data.status as RegistrationStatus };
}

export async function fetchRegistrationAccounts(): Promise<RegistrationAccount[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("registration_accounts")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as RegistrationAccount[];
}

export async function approveRegistration(id: string): Promise<void> {
  if (!supabase) return;
  const { data } = await supabase.from("registration_accounts").select("account_type, status, selected_plan").eq("id", id).single();
  let status: RegistrationStatus = "active";
  if (data?.account_type === "carrier" && data.selected_plan && data.selected_plan !== "free") {
    status = data.status === "pending_payment" ? "pending_payment" : "active";
  }
  if (data?.status === "pending_payment") status = "pending_payment";
  const { error } = await supabase
    .from("registration_accounts")
    .update({ status, updated_at: new Date().toISOString(), rejection_reason: null })
    .eq("id", id);
  if (error) throw error;
}

export async function rejectRegistration(id: string, reason: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from("registration_accounts")
    .update({
      status: "rejected",
      rejection_reason: reason,
      updated_at: new Date().toISOString()
    })
    .eq("id", id);
  if (error) throw error;
}

export async function suspendRegistration(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from("registration_accounts")
    .update({ status: "suspended", suspended: true, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function updateRegistrationPlan(id: string, plan: CarrierPlanId): Promise<void> {
  if (!supabase) return;
  const status: RegistrationStatus = plan === "free" ? "active_preview" : "pending_payment";
  const { error } = await supabase
    .from("registration_accounts")
    .update({ selected_plan: plan, status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function verifyRegistrationMc(id: string, verified: boolean): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from("registration_accounts")
    .update({ mc_verified: verified, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function verifyRegistrationProfile(id: string, verified: boolean): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from("registration_accounts")
    .update({ profile_verified: verified, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export function displayAccountName(account: RegistrationAccount): string {
  const p = account.profile_data;
  if (account.account_type === "carrier") return (p as { companyName: string }).companyName;
  if (account.account_type === "agency") return (p as { agencyName: string }).agencyName;
  return (p as { fullName: string }).fullName;
}
