import { carrierPlanLabel } from "../lib/carrier-plans";
import { fmtPrice } from "../lib/format";
import { supabase } from "../lib/supabase";
import type { CarrierPlanId } from "../types/registration";
import type { AppNotification } from "./notifications";

export type ManagerPaymentPendingCounts = {
  walletDeposits: number;
  carrierPlanPayments: number;
  total: number;
};

export async function fetchManagerPaymentPendingCounts(): Promise<ManagerPaymentPendingCounts> {
  if (!supabase) {
    return { walletDeposits: 0, carrierPlanPayments: 0, total: 0 };
  }

  const [walletRes, carrierRes] = await Promise.all([
    supabase.from("wallet_deposits").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase
      .from("registration_accounts")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_payment")
      .eq("account_type", "carrier")
  ]);

  const walletDeposits = walletRes.count ?? 0;
  const carrierPlanPayments = carrierRes.count ?? 0;
  return {
    walletDeposits,
    carrierPlanPayments,
    total: walletDeposits + carrierPlanPayments
  };
}

export async function fetchManagerPaymentNotifications(): Promise<AppNotification[]> {
  if (!supabase) return [];
  const now = new Date().toISOString();
  const items: AppNotification[] = [];

  const [walletRes, carrierRes] = await Promise.all([
    supabase
      .from("wallet_deposits")
      .select("id, amount, created_at, companies ( name )")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("registration_accounts")
      .select("id, email, selected_plan, profile_data, account_type, created_at")
      .eq("status", "pending_payment")
      .eq("account_type", "carrier")
      .order("created_at", { ascending: false })
      .limit(10)
  ]);

  for (const row of walletRes.data ?? []) {
    const companies = row.companies as { name: string } | { name: string }[] | null;
    const company = Array.isArray(companies) ? companies[0] : companies;
    items.push({
      id: `mgr-wallet-${row.id}`,
      type: "payment",
      title: `Wallet deposit — ${fmtPrice(row.amount)}`,
      body: `${company?.name ?? "Carrier"} completed Whop checkout. Approve to credit wallet.`,
      at: row.created_at ?? now,
      urgency: "today",
      href: "/admin?tab=wallet"
    });
  }

  for (const row of carrierRes.data ?? []) {
    const plan = row.selected_plan ? carrierPlanLabel(row.selected_plan as CarrierPlanId) : "Paid plan";
    const name =
      row.account_type === "carrier"
        ? (row.profile_data as { companyName?: string })?.companyName ?? row.email
        : row.account_type === "agency"
          ? (row.profile_data as { agencyName?: string })?.agencyName ?? row.email
          : (row.profile_data as { fullName?: string })?.fullName ?? row.email;
    items.push({
      id: `mgr-carrier-${row.id}`,
      type: "payment",
      title: `Carrier plan payment — ${plan}`,
      body: `${name} (${row.email}) awaiting Whop confirmation.`,
      at: row.created_at ?? now,
      urgency: "today",
      href: "/admin?tab=registrations"
    });
  }

  return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}
