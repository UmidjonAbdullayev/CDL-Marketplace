import type { SessionUser } from "./session";
import type { DriverCard } from "../types";
import { canActAsCarrier, isPlatformStaff } from "./account-capabilities";

export type MarketplacePriceDisplay = "show" | "blur" | "hidden";

/** Carriers must pass admin MC + profile verification before seeing fees or hiring. */
export function isCarrierMarketplaceVerified(user?: SessionUser | null): boolean {
  if (!user || !canActAsCarrier(user) || isPlatformStaff(user)) return true;
  if (user.accountType !== "carrier") return true;
  return Boolean(user.mcVerified && user.profileVerified);
}

export function isRecruiterAccount(user?: SessionUser | null): boolean {
  return user?.accountType === "agency" || user?.accountType === "solo_recruiter";
}

export function shouldShowDetailPrice(user?: SessionUser | null, sellerCompanyId?: string): boolean {
  if (!user) return false;
  if (isPlatformStaff(user)) return true;
  if (user.accountType === "carrier") return isCarrierMarketplaceVerified(user);
  if (isRecruiterAccount(user)) {
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

  if (isRecruiterAccount(user)) {
    return Boolean(card.sellerCompanyId && card.sellerCompanyId === user.companyId);
  }

  return false;
}

export function marketplacePriceDisplay(
  user: SessionUser | null | undefined,
  card: DriverCard
): MarketplacePriceDisplay {
  if (shouldShowMarketplacePrice(user, card)) return "show";
  if (isRecruiterAccount(user)) return "hidden";
  return "blur";
}

export function detailPriceDisplay(
  user: SessionUser | null | undefined,
  sellerCompanyId?: string
): MarketplacePriceDisplay {
  if (shouldShowDetailPrice(user, sellerCompanyId)) return "show";
  if (isRecruiterAccount(user)) return "hidden";
  return "blur";
}

export function isOwnRecruiterListing(user: SessionUser | null | undefined, card: DriverCard): boolean {
  if (!user?.companyId) return false;
  if (!isRecruiterAccount(user)) return false;
  return card.sellerCompanyId === user.companyId;
}

/** Fee shown on marketplace cards — carriers always see admin-set carrier price, never recruiter list price. */
export function marketplaceDisplayFee(
  user: SessionUser | null | undefined,
  card: DriverCard
): number {
  if (isRecruiterAccount(user)) {
    return card.listPrice ?? card.price;
  }
  if (user?.accountType === "carrier" || (canActAsCarrier(user) && isPlatformStaff(user))) {
    if (card.carrierPrice != null && card.carrierPrice > 0) return card.carrierPrice;
    return 0;
  }
  if (card.carrierPrice != null && card.carrierPrice > 0) return card.carrierPrice;
  return card.price;
}
