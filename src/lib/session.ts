import type { AccountType, AdminRole, CarrierPlanId, RegistrationAccount, RegistrationStatus } from "../types/registration";

export type SessionUser = {
  id: string;
  name: string;
  plan: string;
  selectedPlan: CarrierPlanId | null;
  initials: string;
  email: string;
  accountType: AccountType;
  status: RegistrationStatus;
  profileVerified: boolean;
  companyId: string;
  isAdmin: boolean;
  adminRole: AdminRole;
  walletBalance: number;
};

const SESSION_KEY = "cdl_exchange_session";

const PLAN_LABELS: Record<string, string> = {
  free: "Free Preview",
  starter: "Starter Plan",
  growth: "Growth Plan",
  pro_fleet: "Pro / Fleet Plan"
};

const STATUS_LABELS: Record<string, string> = {
  active_preview: "Free Preview",
  pending_payment: "Payment Pending",
  pending_review: "Pending Review",
  active: "Active",
  rejected: "Rejected",
  suspended: "Suspended"
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function accountDisplayName(account: RegistrationAccount): string {
  const p = account.profile_data;
  if (account.account_type === "carrier") return (p as { companyName: string }).companyName;
  if (account.account_type === "agency") return (p as { agencyName: string }).agencyName;
  return (p as { fullName: string }).fullName;
}

function isPlatformStaffPlan(account: RegistrationAccount): boolean {
  const role = account.admin_role ?? "none";
  return Boolean(account.is_admin || role === "manager" || role === "admin");
}

export function sessionFromAccount(
  account: RegistrationAccount,
  company?: { wallet_balance?: number | null } | null
): SessionUser {
  const name = accountDisplayName(account);
  const plan = account.selected_plan
    ? PLAN_LABELS[account.selected_plan] ?? account.selected_plan
    : STATUS_LABELS[account.status] ?? "Member";

  return {
    id: account.id,
    name,
    plan: isPlatformStaffPlan(account) ? "Platform Operations" : plan,
    initials: initialsFromName(name),
    email: account.email,
    accountType: account.account_type,
    status: account.status,
    profileVerified: Boolean(account.profile_verified),
    selectedPlan: account.account_type === "carrier" ? account.selected_plan ?? "free" : null,
    companyId: account.company_id ?? "",
    isAdmin: Boolean(account.is_admin),
    adminRole: account.admin_role ?? "none",
    walletBalance: Number(company?.wallet_balance ?? 0)
  };
}

export function readSession(): SessionUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function writeSession(user: SessionUser): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function initSession(): SessionUser | null {
  let user = readSession();
  if (!user) return null;
  // Drop legacy sessions from older builds missing per-user company scope
  if (!user.email || !user.companyId) {
    clearSession();
    return null;
  }
  if (user.accountType === "carrier" && user.selectedPlan === undefined) {
    user = { ...user, selectedPlan: "free" };
  }
  if (user.adminRole === undefined) {
    user = { ...user, adminRole: user.isAdmin ? "admin" : "none" };
  }
  if (user.adminRole === "manager" || user.adminRole === "admin") {
    user = { ...user, isAdmin: true };
  }
  if (user.profileVerified === undefined) {
    user = { ...user, profileVerified: false };
  }
  return user;
}
