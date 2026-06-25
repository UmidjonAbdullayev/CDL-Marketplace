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

export { hashPassword };

function companyTypeForAccount(accountType: AccountType): "buyer" | "seller" {
  return accountType === "carrier" ? "buyer" : "seller";
}

function companyNameFromAccount(account: RegistrationAccount): string {
  const p = account.profile_data;
  if (account.account_type === "carrier") return (p as { companyName: string }).companyName;
  if (account.account_type === "agency") return (p as { agencyName: string }).agencyName;
  return (p as { fullName: string }).fullName;
}

async function createCompanyForAccount(account: RegistrationAccount): Promise<string> {
  if (!supabase) throw new Error("Supabase not configured");

  let name = companyNameFromAccount(account).trim();
  if (!name) name = account.email.split("@")[0];

  const basePayload = {
    company_type: companyTypeForAccount(account.account_type),
    wallet_balance: 0,
    rating: 4,
    leads_sold: 0,
    refund_rate: 0,
    status: "active"
  };

  let { data, error } = await supabase
    .from("companies")
    .insert({ name, ...basePayload })
    .select("id")
    .single();

  if (error?.code === "23505") {
    name = `${name} (${account.id.slice(0, 8)})`;
    ({ data, error } = await supabase.from("companies").insert({ name, ...basePayload }).select("id").single());
  }

  if (error || !data) throw error ?? new Error("Failed to create company");
  return data.id;
}

export async function ensureCompanyForAccount(account: RegistrationAccount): Promise<RegistrationAccount> {
  if (!supabase) return account;

  const { data: row, error } = await supabase
    .from("registration_accounts")
    .select("company_id, is_admin, admin_role")
    .eq("id", account.id)
    .single();
  if (error) throw error;

  if (row?.company_id) {
    return { ...account, company_id: row.company_id, is_admin: Boolean(row.is_admin), admin_role: row.admin_role ?? "none" };
  }

  const companyId = await createCompanyForAccount(account);
  const { error: updateErr } = await supabase
    .from("registration_accounts")
    .update({ company_id: companyId, updated_at: new Date().toISOString() })
    .eq("id", account.id);
  if (updateErr) throw updateErr;

  return { ...account, company_id: companyId, is_admin: Boolean(account.is_admin ?? row?.is_admin), admin_role: account.admin_role ?? row?.admin_role ?? "none" };
}

export async function buildSessionAccount(account: RegistrationAccount): Promise<RegistrationAccount> {
  const enriched = await ensureCompanyForAccount(account);
  return enriched;
}

function resolveStatus(accountType: AccountType, plan?: CarrierPlanId): RegistrationStatus {
  if (accountType === "carrier") {
    if (!plan || plan === "free") return "active_preview";
    return "pending_payment";
  }
  return "pending_review";
}

function resolveEmail(payload: RegistrationPayload): string {
  const raw =
    payload.accountType === "solo_recruiter"
      ? (payload.profile as { email: string }).email
      : (payload.profile as { companyEmail: string }).companyEmail;
  return raw.trim().toLowerCase();
}

export async function submitRegistration(
  payload: RegistrationPayload,
  audit: { ip?: string; userAgent?: string }
): Promise<{ id: string; status: RegistrationStatus; account: RegistrationAccount }> {
  if (!supabase) {
    const id = crypto.randomUUID();
    const status = resolveStatus(payload.accountType, payload.selectedPlan);
    const email = resolveEmail(payload);
    const account: RegistrationAccount = {
      id,
      account_type: payload.accountType,
      status,
      selected_plan: payload.accountType === "carrier" ? payload.selectedPlan ?? "free" : null,
      email,
      profile_data: payload.profile,
      policy_accepted: payload.policyAccepted,
      policy_accepted_at: new Date().toISOString(),
      policy_version: payload.policyVersion,
      accepted_ip_address: audit.ip ?? null,
      accepted_user_agent: audit.userAgent ?? null,
      rejection_reason: null,
      mc_verified: false,
      profile_verified: false,
      suspended: false,
      company_id: null,
      is_admin: false,
      admin_role: "none",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    return { id, status, account };
  }

  const password_hash = await hashPassword(payload.password);
  const status = resolveStatus(payload.accountType, payload.selectedPlan);
  const email = resolveEmail(payload);

  const { authUserId } = await (async () => {
    if (!supabase) throw new Error("Supabase not configured");
    const { data, error: authErr } = await supabase.auth.signUp({
      email,
      password: payload.password,
      options: { data: { account_type: payload.accountType } }
    });
    if (authErr) throw authErr;
    if (!data.user?.id) throw new Error("Could not create auth user");
    return { authUserId: data.user.id };
  })();

  const { data, error } = await supabase
    .from("registration_accounts")
    .insert({
      account_type: payload.accountType,
      status,
      selected_plan: payload.accountType === "carrier" ? payload.selectedPlan ?? "free" : null,
      email,
      auth_user_id: authUserId,
      password_hash,
      profile_data: payload.profile,
      policy_accepted: payload.policyAccepted,
      policy_accepted_at: new Date().toISOString(),
      policy_version: payload.policyVersion,
      accepted_ip_address: audit.ip ?? null,
      accepted_user_agent: audit.userAgent ?? null
    })
    .select("*")
    .single();

  if (error) throw error;
  const account = await ensureCompanyForAccount(data as RegistrationAccount);
  return { id: account.id, status: account.status as RegistrationStatus, account };
}

export async function authenticateRegistration(
  email: string,
  password: string
): Promise<RegistrationAccount | null> {
  const { signInWithEmailPassword } = await import("./auth");
  try {
    return await signInWithEmailPassword(email, password);
  } catch {
    return null;
  }
}

export async function fetchRegistrationByAuthUserId(authUserId: string): Promise<RegistrationAccount | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("registration_accounts")
    .select("*")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error) throw error;
  return data as RegistrationAccount | null;
}

export async function fetchRegistrationByEmail(email: string): Promise<RegistrationAccount | null> {
  if (!supabase) return null;
  const normalized = email.trim().toLowerCase();
  const { data, error } = await supabase
    .from("registration_accounts")
    .select("*")
    .ilike("email", normalized)
    .maybeSingle();
  if (error) throw error;
  return data as RegistrationAccount | null;
}

export async function fetchRegistrationById(id: string): Promise<RegistrationAccount | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from("registration_accounts").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as RegistrationAccount | null;
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

/** Manager confirms Whop payment received — activates paid carrier plan. */
export async function confirmCarrierPayment(id: string): Promise<void> {
  if (!supabase) return;
  const { data, error: fetchErr } = await supabase
    .from("registration_accounts")
    .select("account_type, status, selected_plan, company_id")
    .eq("id", id)
    .single();
  if (fetchErr || !data) throw fetchErr ?? new Error("Account not found");
  if (data.account_type !== "carrier") throw new Error("Only carrier accounts have subscription payments");
  if (data.status !== "pending_payment") throw new Error("Account is not awaiting payment confirmation");
  if (!data.selected_plan || data.selected_plan === "free") throw new Error("No paid plan selected");

  const { error } = await supabase
    .from("registration_accounts")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export type CarrierBillingContext = {
  status: RegistrationStatus | null;
  plan: CarrierPlanId | null;
};

export async function fetchCarrierBillingByCompany(companyId: string): Promise<CarrierBillingContext> {
  if (!supabase || !companyId) return { status: null, plan: null };
  const { data, error } = await supabase
    .from("registration_accounts")
    .select("status, selected_plan")
    .eq("company_id", companyId)
    .eq("account_type", "carrier")
    .maybeSingle();
  if (error) throw error;
  return {
    status: (data?.status as RegistrationStatus) ?? null,
    plan: (data?.selected_plan as CarrierPlanId) ?? null
  };
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
