import { getActiveCompanyId } from "../lib/activeCompany";
import { activeHireLimitForPlan } from "../lib/carrier-plans";
import { supabase } from "../lib/supabase";
import { fetchCarrierBillingByCompany } from "./registration";
import type { CarrierPlanId, RegistrationStatus } from "../types/registration";

/** Default caps before any completed deal (build trust). */
export const STARTER_LIMITS = {
  carrierActiveHires: 1,
  recruiterActiveListings: 3
} as const;

/** Caps after at least one completed deal on the platform. */
export const TRUSTED_LIMITS = {
  carrierActiveHires: 5,
  recruiterActiveListings: 10
} as const;

export type LimitTier = "starter" | "trusted" | "custom" | "plan";

export type CompanyLimitSnapshot = {
  companyId: string;
  role: "carrier" | "recruiter";
  tier: LimitTier;
  limit: number;
  used: number;
  completedDeals: number;
  customMaxHires: number | null;
  customMaxListings: number | null;
  carrierPlan?: CarrierPlanId | null;
  carrierStatus?: RegistrationStatus | null;
  lifetimeDealCap?: boolean;
};

export class PlatformLimitError extends Error {
  readonly code = "PLATFORM_LIMIT";
  readonly snapshot: CompanyLimitSnapshot;

  constructor(message: string, snapshot: CompanyLimitSnapshot) {
    super(message);
    this.name = "PlatformLimitError";
    this.snapshot = snapshot;
  }
}

function isActiveDeal(status: string, hiringStage: string): boolean {
  return status !== "Completed" && hiringStage !== "completed";
}

function isCompletedDeal(status: string): boolean {
  return status === "Completed" || status === "Hired Confirmed";
}

export async function countCompletedDeals(
  companyId: string,
  role: "buyer" | "seller"
): Promise<number> {
  if (!supabase) return 0;
  const column = role === "buyer" ? "buyer_company_id" : "seller_company_id";
  const { count, error } = await supabase
    .from("deals")
    .select("id", { count: "exact", head: true })
    .eq(column, companyId)
    .in("status", ["Completed", "Hired Confirmed"]);
  if (error) throw error;
  return count ?? 0;
}

export async function countActiveHires(buyerCompanyId: string): Promise<number> {
  if (!supabase) return 0;
  const { data, error } = await supabase
    .from("deals")
    .select("status, hiring_stage")
    .eq("buyer_company_id", buyerCompanyId);
  if (error) throw error;
  return (data ?? []).filter((d) => isActiveDeal(d.status, d.hiring_stage)).length;
}

export async function countTotalBuyerDeals(buyerCompanyId: string): Promise<number> {
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from("deals")
    .select("id", { count: "exact", head: true })
    .eq("buyer_company_id", buyerCompanyId);
  if (error) throw error;
  return count ?? 0;
}

export async function countActiveListings(sellerCompanyId: string): Promise<number> {
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from("driver_listings")
    .select("id", { count: "exact", head: true })
    .eq("seller_company_id", sellerCompanyId)
    .in("status", ["pending", "active", "reserved", "hiring", "paused"]);
  if (error) throw error;
  return count ?? 0;
}

async function fetchCompanyLimitOverrides(companyId: string): Promise<{
  max_active_hires: number | null;
  max_active_listings: number | null;
  company_type: string;
}> {
  if (!supabase) {
    return { max_active_hires: null, max_active_listings: null, company_type: "buyer" };
  }
  const { data, error } = await supabase
    .from("companies")
    .select("max_active_hires, max_active_listings, company_type")
    .eq("id", companyId)
    .maybeSingle();
  if (error) throw error;
  return {
    max_active_hires: data?.max_active_hires ?? null,
    max_active_listings: data?.max_active_listings ?? null,
    company_type: data?.company_type ?? "buyer"
  };
}

function defaultHireLimit(completedAsBuyer: number, custom: number | null): { limit: number; tier: LimitTier } {
  if (custom != null && custom >= 0) return { limit: custom, tier: "custom" };
  if (completedAsBuyer >= 1) return { limit: TRUSTED_LIMITS.carrierActiveHires, tier: "trusted" };
  return { limit: STARTER_LIMITS.carrierActiveHires, tier: "starter" };
}

function defaultListingLimit(completedAsSeller: number, custom: number | null): { limit: number; tier: LimitTier } {
  if (custom != null && custom >= 0) return { limit: custom, tier: "custom" };
  if (completedAsSeller >= 1) return { limit: TRUSTED_LIMITS.recruiterActiveListings, tier: "trusted" };
  return { limit: STARTER_LIMITS.recruiterActiveListings, tier: "starter" };
}

function usesLifetimeDealCap(status: RegistrationStatus | null, plan: CarrierPlanId | null): boolean {
  if (status === "pending_payment") return true;
  if (status === "active_preview" || !plan || plan === "free") return true;
  return false;
}

export async function resolveHireLimit(buyerCompanyId: string): Promise<CompanyLimitSnapshot> {
  const [overrides, activeHires, completedDeals, totalDeals, billing] = await Promise.all([
    fetchCompanyLimitOverrides(buyerCompanyId),
    countActiveHires(buyerCompanyId),
    countCompletedDeals(buyerCompanyId, "buyer"),
    countTotalBuyerDeals(buyerCompanyId),
    fetchCarrierBillingByCompany(buyerCompanyId)
  ]);

  const plan = billing.plan ?? "free";
  const status = billing.status;
  const lifetimeCap = usesLifetimeDealCap(status, plan);

  if (lifetimeCap) {
    return {
      companyId: buyerCompanyId,
      role: "carrier",
      tier: status === "pending_payment" ? "starter" : "starter",
      limit: 1,
      used: totalDeals,
      completedDeals,
      customMaxHires: overrides.max_active_hires,
      customMaxListings: overrides.max_active_listings,
      carrierPlan: plan,
      carrierStatus: status,
      lifetimeDealCap: true
    };
  }

  const isPaidActive = status === "active" && plan && plan !== "free";
  let limit: number;
  let tier: LimitTier;

  if (overrides.max_active_hires != null && overrides.max_active_hires >= 0) {
    limit = overrides.max_active_hires;
    tier = "custom";
  } else if (isPaidActive) {
    limit = activeHireLimitForPlan(plan) ?? 999;
    tier = "plan";
  } else {
    const trust = defaultHireLimit(completedDeals, null);
    limit = trust.limit;
    tier = trust.tier;
  }

  return {
    companyId: buyerCompanyId,
    role: "carrier",
    tier,
    limit,
    used: activeHires,
    completedDeals,
    customMaxHires: overrides.max_active_hires,
    customMaxListings: overrides.max_active_listings,
    carrierPlan: plan,
    carrierStatus: status,
    lifetimeDealCap: false
  };
}

export async function resolveListingLimit(sellerCompanyId?: string): Promise<CompanyLimitSnapshot> {
  const companyId = sellerCompanyId ?? getActiveCompanyId();
  const [overrides, used, completedDeals] = await Promise.all([
    fetchCompanyLimitOverrides(companyId),
    countActiveListings(companyId),
    countCompletedDeals(companyId, "seller")
  ]);
  const { limit, tier } = defaultListingLimit(completedDeals, overrides.max_active_listings);
  return {
    companyId,
    role: "recruiter",
    tier,
    limit,
    used,
    completedDeals,
    customMaxHires: overrides.max_active_hires,
    customMaxListings: overrides.max_active_listings
  };
}

export async function assertCanStartHiring(buyerCompanyId?: string): Promise<CompanyLimitSnapshot> {
  const companyId = buyerCompanyId ?? getActiveCompanyId();
  const snapshot = await resolveHireLimit(companyId);
  if (snapshot.used >= snapshot.limit) {
    let msg: string;
    if (snapshot.lifetimeDealCap) {
      if (snapshot.carrierStatus === "pending_payment") {
        msg =
          "Your payment is still being verified. Until your plan is activated you can only have one hire (active or completed). Complete Whop checkout or wait for manager confirmation.";
      } else {
        msg =
          "Free preview accounts are limited to one hire total (active or completed). Upgrade to a paid plan on Pricing to hire more drivers.";
      }
    } else if (snapshot.tier === "starter" || snapshot.tier === "trusted") {
      msg = `You have reached your limit of ${snapshot.limit} active hire${snapshot.limit === 1 ? "" : "s"}. Complete a deal to unlock more capacity, or contact your platform manager for a custom limit.`;
    } else if (snapshot.limit >= 999) {
      msg = "Unable to start a new hire. Contact platform support.";
    } else {
      msg = `You have reached your plan limit of ${snapshot.limit} active hire${snapshot.limit === 1 ? "" : "s"}. Complete an existing deal or upgrade your plan.`;
    }
    throw new PlatformLimitError(msg, snapshot);
  }
  return snapshot;
}

export async function assertCanCreateListing(sellerCompanyId?: string): Promise<CompanyLimitSnapshot> {
  const companyId = sellerCompanyId ?? getActiveCompanyId();
  const snapshot = await resolveListingLimit(companyId);
  if (snapshot.used >= snapshot.limit) {
    const msg =
      snapshot.tier === "starter"
        ? `New recruiters may list up to ${snapshot.limit} active drivers until your first deal is completed. Complete a sale or contact your platform manager for higher limits.`
        : `You have reached your limit of ${snapshot.limit} active listings. Expire or complete existing listings, or contact your platform manager for a custom limit.`;
    throw new PlatformLimitError(msg, snapshot);
  }
  return snapshot;
}

export type CompanyLimitRow = {
  id: string;
  name: string;
  company_type: string;
  max_active_hires: number | null;
  max_active_listings: number | null;
  completed_as_buyer: number;
  completed_as_seller: number;
  active_hires: number;
  active_listings: number;
};

export async function fetchCompaniesForLimitManagement(): Promise<CompanyLimitRow[]> {
  if (!supabase) return [];
  const { data: companies, error } = await supabase
    .from("companies")
    .select("id, name, company_type, max_active_hires, max_active_listings")
    .neq("company_type", "platform")
    .order("name");
  if (error) throw error;
  if (!companies?.length) return [];

  const ids = companies.map((c) => c.id);
  const [{ data: buyerDeals }, { data: sellerDeals }, { data: listings }] = await Promise.all([
    supabase.from("deals").select("buyer_company_id, status, hiring_stage").in("buyer_company_id", ids),
    supabase.from("deals").select("seller_company_id, status").in("seller_company_id", ids),
    supabase.from("driver_listings").select("seller_company_id, status").in("seller_company_id", ids)
  ]);

  return companies.map((c) => {
    const companyBuyerDeals = (buyerDeals ?? []).filter((d) => d.buyer_company_id === c.id);
    const companySellerDeals = (sellerDeals ?? []).filter((d) => d.seller_company_id === c.id);
    const completedAsBuyer = companyBuyerDeals.filter((d) => isCompletedDeal(d.status)).length;
    const completedAsSeller = companySellerDeals.filter((d) => isCompletedDeal(d.status)).length;
    const activeHires = companyBuyerDeals.filter((d) => isActiveDeal(d.status, d.hiring_stage ?? "")).length;
    const activeListings = (listings ?? []).filter(
      (l) =>
        l.seller_company_id === c.id &&
        ["pending", "active", "reserved", "hiring", "paused"].includes(l.status)
    ).length;

    return {
      id: c.id,
      name: c.name,
      company_type: c.company_type,
      max_active_hires: c.max_active_hires,
      max_active_listings: c.max_active_listings,
      completed_as_buyer: completedAsBuyer,
      completed_as_seller: completedAsSeller,
      active_hires: activeHires,
      active_listings: activeListings
    };
  });
}

export async function updateCompanyLimits(
  companyId: string,
  limits: { maxActiveHires?: number | null; maxActiveListings?: number | null }
): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const payload: Record<string, unknown> = {};
  if (limits.maxActiveHires !== undefined) payload.max_active_hires = limits.maxActiveHires;
  if (limits.maxActiveListings !== undefined) payload.max_active_listings = limits.maxActiveListings;
  if (!Object.keys(payload).length) return;
  const { data, error } = await supabase.from("companies").update(payload).eq("id", companyId).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Company not found or you do not have permission to update limits");
}

export function limitHint(snapshot: CompanyLimitSnapshot): string {
  const remaining = Math.max(0, snapshot.limit - snapshot.used);
  if (snapshot.role === "carrier") {
    if (snapshot.lifetimeDealCap) {
      if (snapshot.carrierStatus === "pending_payment") {
        return `${remaining} of ${snapshot.limit} hire slot remaining while payment is verified.`;
      }
      return `${remaining} of ${snapshot.limit} lifetime hire slot${snapshot.limit === 1 ? "" : "s"} on free preview.`;
    }
    if (snapshot.tier === "starter") {
      return `${remaining} of ${snapshot.limit} active hire${snapshot.limit === 1 ? "" : "s"} remaining. Complete your first hire to unlock ${TRUSTED_LIMITS.carrierActiveHires}.`;
    }
    if (snapshot.tier === "trusted") {
      return `${remaining} of ${snapshot.limit} active hires remaining (trust tier).`;
    }
    if (snapshot.limit >= 999) return "Unlimited active hires on your plan.";
    return `${remaining} of ${snapshot.limit} active hire${snapshot.limit === 1 ? "" : "s"} remaining on your plan.`;
  }
  if (snapshot.tier === "starter") {
    return `${remaining} of ${snapshot.limit} listing slots remaining. Complete your first sale to list up to ${TRUSTED_LIMITS.recruiterActiveListings} drivers.`;
  }
  return `${remaining} of ${snapshot.limit} active listings remaining${snapshot.tier === "custom" ? " (manager override)" : ""}.`;
}
