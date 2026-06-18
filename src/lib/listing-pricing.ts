import type { DriverType } from "./driver-types";

/** Platform commission taken from recruiter listing price */
export const PLATFORM_FEE_RATE = 0.15;

export const RECRUITER_PRICE_CAP: Record<DriverType, number> = {
  "Company Driver": 650,
  Team: 1000,
  Lease: 1000,
  "Owner Operator": 1000
};

export type ListingPricing = {
  listPrice: number;
  platformFee: number;
  netPayout: number;
  carrierPrice: number | null;
  adminMarkup: number;
};

export function maxRecruiterPrice(driverType: string): number {
  return RECRUITER_PRICE_CAP[driverType as DriverType] ?? 1000;
}

export function computeListingPricing(listPrice: number, adminMarkup = 0): Omit<ListingPricing, "carrierPrice"> & { carrierPrice: number } {
  const platformFee = Math.round(listPrice * PLATFORM_FEE_RATE);
  const netPayout = listPrice - platformFee;
  const carrierPrice = listPrice + adminMarkup;
  return { listPrice, platformFee, netPayout, adminMarkup, carrierPrice };
}

export function validateRecruiterListPrice(price: number, driverType: string): string | null {
  if (price < 50) return "Minimum listing price is $50.";
  const cap = maxRecruiterPrice(driverType);
  if (price > cap) {
    return `Maximum listing price for ${driverType} is $${cap.toLocaleString()}.`;
  }
  return null;
}

export type MarketplaceViewer = "carrier" | "recruiter";

export function displayPriceForViewer(
  viewer: MarketplaceViewer,
  row: {
    price: number;
    net_payout?: number | null;
    carrier_price?: number | null;
  }
): { amount: number; label: string } {
  if (viewer === "carrier") {
    const amount = row.carrier_price != null && row.carrier_price > 0 ? row.carrier_price : 0;
    return { amount, label: "Platform recruiting fee" };
  }
  return { amount: row.price, label: "Listing price" };
}

export function marketplaceViewerFromAccountType(accountType?: string): MarketplaceViewer {
  return accountType === "carrier" ? "carrier" : "recruiter";
}

export function canCarrierViewListing(row: { carrier_price?: number | null; status?: string }): boolean {
  return Boolean(row.carrier_price != null && row.carrier_price > 0);
}
