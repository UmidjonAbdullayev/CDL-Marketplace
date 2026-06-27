import type { SessionUser } from "./session";
import type { DriverCard } from "../types";
import { canActAsCarrier, isPlatformStaff } from "./account-capabilities";

/** Carriers must pass admin MC + profile verification before seeing fees or hiring. */
export function isCarrierMarketplaceVerified(user?: SessionUser | null): boolean {
  if (!user || !canActAsCarrier(user) || isPlatformStaff(user)) return true;
  if (user.accountType !== "carrier") return true;
  return Boolean(user.mcVerified && user.profileVerified);
}

export function shouldShowDetailPrice(user?: SessionUser | null, sellerCompanyId?: string): boolean {
  if (!user) return false;
  if (isPlatformStaff(user)) return true;
  if (user.accountType === "carrier") return isCarrierMarketplaceVerified(user);
  if (user.accountType === "agency" || user.accountType === "solo_recruiter") {
    return Boolean(sellerCompanyId && sellerCompanyId === user.companyId);
  }
  return false;
}

export function shouldShowMarketplacePrice(
  user: SessionUser | null | undefined,
  card: DriverCard
): boolean {
  if (!user) return false;
  if (isPlatformStaff(user)) return true;

  if (user.accountType === "carrier") {
    return isCarrierMarketplaceVerified(user);
  }

  if (user.accountType === "agency" || user.accountType === "solo_recruiter") {
    return Boolean(card.sellerCompanyId && card.sellerCompanyId === user.companyId);
  }

  return false;
}

export function isOwnRecruiterListing(user: SessionUser | null | undefined, card: DriverCard): boolean {
  if (!user?.companyId) return false;
  if (user.accountType !== "agency" && user.accountType !== "solo_recruiter") return false;
  return card.sellerCompanyId === user.companyId;
}
