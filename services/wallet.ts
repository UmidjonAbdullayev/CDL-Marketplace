import { getActiveCompanyId } from "../lib/activeCompany";
import { supabase } from "../lib/supabase";
import { WALLET_DEPOSIT_OPTIONS, type WalletDepositTierId } from "../lib/wallet-deposits";
import { fetchCompanyById } from "./company";

export type WalletDepositStatus = "pending" | "approved" | "rejected";

export type WalletDepositRow = {
  id: string;
  company_id: string;
  amount: number;
  whop_checkout_url: string;
  status: WalletDepositStatus;
  rejection_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  company_name?: string;
};

export class WalletInsufficientError extends Error {
  readonly code = "WALLET_INSUFFICIENT";
  readonly required: number;
  readonly available: number;

  constructor(required: number, available: number) {
    super(
      `Insufficient wallet balance. This deal requires $${required.toLocaleString()} but you have $${available.toLocaleString()} available. Deposit funds and wait for manager approval.`
    );
    this.name = "WalletInsufficientError";
    this.required = required;
    this.available = available;
  }
}

export async function fetchCompanyWalletBalance(companyId?: string): Promise<number> {
  const id = companyId ?? getActiveCompanyId();
  const company = await fetchCompanyById(id);
  return Number(company?.wallet_balance ?? 0);
}

export async function fetchCompanyPendingDeposit(companyId?: string): Promise<WalletDepositRow | null> {
  if (!supabase) return null;
  const id = companyId ?? getActiveCompanyId();
  const { data, error } = await supabase
    .from("wallet_deposits")
    .select("*")
    .eq("company_id", id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as WalletDepositRow | null;
}

export async function fetchCompanyLatestRejectedDeposit(companyId?: string): Promise<WalletDepositRow | null> {
  if (!supabase) return null;
  const id = companyId ?? getActiveCompanyId();
  const { data, error } = await supabase
    .from("wallet_deposits")
    .select("*")
    .eq("company_id", id)
    .eq("status", "rejected")
    .order("reviewed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as WalletDepositRow | null;
}

export async function createPendingWalletDeposit(tierId: WalletDepositTierId): Promise<WalletDepositRow> {
  if (!supabase) throw new Error("Supabase not configured");
  const option = WALLET_DEPOSIT_OPTIONS.find((o) => o.id === tierId);
  if (!option) throw new Error("Invalid deposit option");

  const companyId = getActiveCompanyId();
  const existing = await fetchCompanyPendingDeposit(companyId);
  if (existing) {
    throw new Error("You already have a deposit awaiting manager approval. Wait for review before submitting another.");
  }

  const { data, error } = await supabase
    .from("wallet_deposits")
    .insert({
      company_id: companyId,
      amount: option.amount,
      whop_checkout_url: option.checkoutUrl,
      status: "pending"
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as WalletDepositRow;
}

export async function fetchWalletDepositsForAdmin(status?: WalletDepositStatus): Promise<WalletDepositRow[]> {
  if (!supabase) return [];
  let query = supabase
    .from("wallet_deposits")
    .select("*, companies ( name )")
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => {
    const companies = row.companies as { name: string } | { name: string }[] | null;
    const company = Array.isArray(companies) ? companies[0] : companies;
    const { companies: _c, ...rest } = row;
    return {
      ...(rest as WalletDepositRow),
      company_name: company?.name ?? "Company"
    };
  });
}

export async function approveWalletDeposit(depositId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");

  const { data: deposit, error: fetchErr } = await supabase
    .from("wallet_deposits")
    .select("id, company_id, amount, status")
    .eq("id", depositId)
    .single();
  if (fetchErr || !deposit) throw fetchErr ?? new Error("Deposit not found");
  if (deposit.status !== "pending") throw new Error("Deposit is not pending approval");

  const company = await fetchCompanyById(deposit.company_id);
  if (!company) throw new Error("Company not found");

  const newBalance = Number(company.wallet_balance ?? 0) + deposit.amount;
  const now = new Date().toISOString();

  const { error: companyErr } = await supabase
    .from("companies")
    .update({ wallet_balance: newBalance })
    .eq("id", deposit.company_id);
  if (companyErr) throw companyErr;

  const { error: depositErr } = await supabase
    .from("wallet_deposits")
    .update({ status: "approved", reviewed_at: now, updated_at: now, rejection_reason: null })
    .eq("id", depositId);
  if (depositErr) throw depositErr;
}

export async function rejectWalletDeposit(depositId: string, reason: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const trimmed = reason.trim();
  if (!trimmed) throw new Error("Rejection reason is required");

  const { data: deposit, error: fetchErr } = await supabase
    .from("wallet_deposits")
    .select("id, status")
    .eq("id", depositId)
    .single();
  if (fetchErr || !deposit) throw fetchErr ?? new Error("Deposit not found");
  if (deposit.status !== "pending") throw new Error("Deposit is not pending approval");

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("wallet_deposits")
    .update({ status: "rejected", rejection_reason: trimmed, reviewed_at: now, updated_at: now })
    .eq("id", depositId);
  if (error) throw error;
}

/** Deduct approved wallet funds when escrow is held for a new deal. */
export async function deductWalletBalance(companyId: string, amount: number): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  if (amount <= 0) throw new Error("Invalid escrow amount");

  const company = await fetchCompanyById(companyId);
  if (!company) throw new Error("Company not found");

  const available = Number(company.wallet_balance ?? 0);
  if (available < amount) {
    throw new WalletInsufficientError(amount, available);
  }

  const { error } = await supabase
    .from("companies")
    .update({ wallet_balance: available - amount })
    .eq("id", companyId);
  if (error) throw error;
}

export async function assertWalletCanCoverDeal(companyId: string, amount: number): Promise<void> {
  const available = await fetchCompanyWalletBalance(companyId);
  if (available < amount) {
    throw new WalletInsufficientError(amount, available);
  }
}
