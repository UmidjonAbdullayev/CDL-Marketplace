import type { MarketplaceViewer } from "./listing-pricing";
import type { SessionUser } from "./session";

export function isPlatformStaff(user?: SessionUser | null): boolean {
  if (!user) return false;
  return Boolean(user.isAdmin || (user.adminRole && user.adminRole !== "none"));
}

export function isPlatformManager(user?: SessionUser | null): boolean {
  return user?.adminRole === "manager";
}

export function canAccessAdminPanel(user?: SessionUser | null): boolean {
  return isPlatformStaff(user);
}

/** Carriers and platform staff can browse carrier pricing and start hiring. */
export function canActAsCarrier(user?: SessionUser | null): boolean {
  if (!user) return false;
  return user.accountType === "carrier" || isPlatformStaff(user);
}

export function canStartHiring(user?: SessionUser | null): boolean {
  return canActAsCarrier(user);
}

export function marketplaceViewerForUser(user?: SessionUser | null): MarketplaceViewer {
  return canActAsCarrier(user) ? "carrier" : "recruiter";
}

export function accountTypeLabel(user?: SessionUser | null): string {
  if (!user) return "";
  if (user.adminRole === "manager") return "Platform Manager";
  if (user.adminRole === "admin") return "Platform Admin";
  if (user.accountType === "carrier") return "Carrier";
  if (user.accountType === "agency") return "Agency";
  return "Solo Recruiter";
}

export function isSellerNav(user?: SessionUser | null): boolean {
  if (!user) return false;
  if (isPlatformStaff(user)) return false;
  return user.accountType === "agency" || user.accountType === "solo_recruiter";
}
