import { getActiveCompanyId } from "../lib/activeCompany";
import type { DriverType } from "../lib/driver-types";
import { supabase } from "../lib/supabase";
import type { Driver, DriverCard, HotListing, Paginated, ScoreFlag } from "../types";
import type { AccountType } from "../types/registration";
import { formatDriverExperience, formatDriverExperienceShort } from "../lib/driver-experience";
import { computeListingPricing, displayPriceForViewer, type MarketplaceViewer, validateRecruiterListPrice } from "../lib/listing-pricing";
import { avatarUrlFromProfileData } from "./adminProfiles";
import { enrichMessagesWithAttachmentUrls, uploadChatAttachment } from "./chatAttachments";
import { autoAssignListing } from "./platformAdmin";
import { assertCanCreateListing } from "./platformLimits";

const NEW_LISTING_MS = 7 * 86400000;

export const DEFAULT_PAGE_SIZE = 50;

export type PageParams = { page?: number; pageSize?: number };

type ListingCardRow = {
  id: number;
  first_name: string;
  last_name: string;
  state: string;
  years_exp: number;
  months_exp?: number;
  cdl_class: string;
  equipment: string;
  available_date: string;
  score_flag: ScoreFlag;
  verified: boolean;
  price: number;
  platform_fee?: number | null;
  net_payout?: number | null;
  carrier_price?: number | null;
  driver_type: DriverType;
  featured: boolean;
  created_at: string;
  seller_company_id?: string;
  desired_weekly_pay?: string | null;
  weeks_out_preference?: string | null;
  max_dispatch_fee_pct?: number | null;
  company_expectations?: string | null;
  companies: { name: string; rating: number } | { name: string; rating: number }[] | null;
};

type ListingDetailRow = ListingCardRow & {
  endorsements: string[];
  phone: string;
  email: string;
  cdl_number: string;
  documents: string[];
  notes: string;
  route_pref: string;
  desired_weekly_pay?: string | null;
  weeks_out_preference?: string | null;
  max_dispatch_fee_pct?: number | null;
  company_expectations?: string | null;
  status: string;
  views: number;
  hot_score: number | null;
  seller_company_id: string;
};

export const LISTING_CARD_SELECT =
  "id, first_name, last_name, state, years_exp, months_exp, cdl_class, equipment, available_date, score_flag, verified, price, platform_fee, net_payout, carrier_price, hot_score, route_pref, driver_type, featured, created_at, seller_company_id, desired_weekly_pay, weeks_out_preference, max_dispatch_fee_pct, company_expectations, companies (name, rating)";

export const LISTING_DETAIL_SELECT =
  `${LISTING_CARD_SELECT}, endorsements, phone, email, cdl_number, documents, notes, status, views, hot_score, assigned_admin_id`;

export function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function toPaginated<T>(items: T[], total: number | null, page: number, pageSize: number): Paginated<T> {
  const count = total ?? items.length;
  return {
    items,
    total: count,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(count / pageSize))
  };
}

function escapeIlike(term: string): string {
  return term.replace(/[%_\\]/g, "\\$&");
}

type ListingCardRowWithHot = ListingCardRow & { hot_score?: number | null; route_pref?: string };

export function rowToCard(row: ListingCardRowWithHot, viewer: MarketplaceViewer = "carrier"): DriverCard {
  const company = unwrapRelation(row.companies);
  const hotScore = row.hot_score ?? 0;
  const createdAt = row.created_at ?? new Date().toISOString();
  const { amount, label } = displayPriceForViewer(viewer, row);
  const hideRecruiterPricing = viewer === "carrier";
  const expYears = row.years_exp ?? 0;
  const expMonths = row.months_exp ?? 0;
  return {
    id: row.id,
    first: row.first_name,
    last: row.last_name,
    state: row.state,
    exp: expYears,
    expYears,
    expMonths,
    expLabel: formatDriverExperience(expYears, expMonths),
    cdl: row.cdl_class,
    equip: row.equipment,
    avail: row.available_date,
    score: row.score_flag,
    verified: row.verified,
    price: amount,
    priceLabel: label,
    listPrice: hideRecruiterPricing ? undefined : row.price,
    netPayout: hideRecruiterPricing ? undefined : row.net_payout ?? null,
    carrierPrice: hideRecruiterPricing ? row.carrier_price ?? null : undefined,
    seller: company?.name ?? "Verified Seller",
    sellerRating: Number(company?.rating ?? 4),
    sellerCompanyId: row.seller_company_id,
    hotScore,
    isTrending: hotScore >= 80,
    driverType: row.driver_type ?? "Owner Operator",
    featured: row.featured ?? false,
    createdAt,
    isNew: Date.now() - new Date(createdAt).getTime() < NEW_LISTING_MS,
    desiredWeeklyPay: row.desired_weekly_pay ?? undefined,
    weeksOutPreference: row.weeks_out_preference ?? undefined,
    maxDispatchFeePct: row.max_dispatch_fee_pct ?? null,
    companyExpectations: row.company_expectations ?? undefined
  };
}

export function rowToDriver(row: ListingDetailRow, viewer: MarketplaceViewer = "carrier"): Driver {
  const card = rowToCard(row, viewer);
  const detail = row as ListingDetailRow & { seller_company_id?: string };
  return {
    ...card,
    endorse: row.endorsements ?? [],
    phone: row.phone,
    email: row.email,
    cdlNum: row.cdl_number,
    docs: row.documents ?? [],
    notes: row.notes ?? "",
    sellerCompanyId: detail.seller_company_id
  };
}

export type ListingFilters = {
  state?: string;
  cdl?: string;
  exp?: number;
  equip?: string;
  score?: string;
  priceMin?: number;
  priceMax?: number;
  verified?: boolean;
  search?: string;
  route?: string;
  minHotScore?: number;
  hotOnly?: boolean;
  driverType?: string;
  postedSince?: string;
};

export type DashboardPeriod = "24h" | "7d" | "30d";

function periodSince(period: DashboardPeriod): string {
  const ms = period === "24h" ? 86400000 : period === "7d" ? 7 * 86400000 : 30 * 86400000;
  return new Date(Date.now() - ms).toISOString();
}

async function fetchListingIdsBlockedByActiveDeals(): Promise<number[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("deals")
    .select("listing_id")
    .not("status", "eq", "Completed")
    .neq("hiring_stage", "completed");
  if (error) throw error;
  return [...new Set((data ?? []).map((d) => d.listing_id).filter((id): id is number => id != null))];
}

export async function fetchTrendingListingIds(): Promise<Set<number>> {
  if (!supabase) return new Set();
  const { data } = await supabase
    .from("driver_listings")
    .select("id")
    .in("status", ["active", "reserved"])
    .gte("hot_score", 80);
  return new Set((data ?? []).map((r) => r.id));
}

export async function fetchMarketplaceStates(): Promise<string[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("driver_listings")
    .select("state")
    .in("status", ["active", "reserved"]);
  if (error) throw error;
  return [...new Set((data ?? []).map((r) => r.state))].sort();
}

export async function fetchDriverCardsPage(
  filters: ListingFilters,
  { page = 1, pageSize = DEFAULT_PAGE_SIZE, viewer = "carrier" as MarketplaceViewer }: PageParams & { viewer?: MarketplaceViewer } = {}
): Promise<Paginated<DriverCard>> {
  if (!supabase) return toPaginated([], 0, page, pageSize);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const blockedListingIds = await fetchListingIdsBlockedByActiveDeals();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase
    .from("driver_listings")
    .select(LISTING_CARD_SELECT, { count: "exact" })
    .eq("status", "active");

  if (blockedListingIds.length) {
    q = q.not("id", "in", `(${blockedListingIds.join(",")})`);
  }

  if (viewer === "carrier") {
    q = q.not("carrier_price", "is", null).gt("carrier_price", 0);
  }

  if (filters.state) q = q.eq("state", filters.state);
  if (filters.cdl) q = q.eq("cdl_class", filters.cdl);
  if (filters.exp) q = q.gte("total_exp_months", filters.exp * 12);
  if (filters.equip) q = q.eq("equipment", filters.equip);
  if (filters.score) q = q.eq("score_flag", filters.score);
  if (filters.priceMin) {
    q = viewer === "carrier"
      ? q.gte("carrier_price", filters.priceMin)
      : q.gte("price", filters.priceMin);
  }
  if (filters.priceMax && filters.priceMax < 99999) {
    q = viewer === "carrier"
      ? q.lte("carrier_price", filters.priceMax)
      : q.lte("price", filters.priceMax);
  }
  if (filters.verified) q = q.eq("verified", true);
  if (filters.route) q = q.eq("route_pref", filters.route);
  if (filters.minHotScore) q = q.gte("hot_score", filters.minHotScore);
  if (filters.hotOnly) q = q.gte("hot_score", 80);
  if (filters.driverType) q = q.eq("driver_type", filters.driverType);
  if (filters.postedSince) q = q.gte("created_at", filters.postedSince);
  const search = filters.search?.trim();
  if (search) {
    const pattern = `%${escapeIlike(search)}%`;
    q = q.or(
      `first_name.ilike.${pattern},last_name.ilike.${pattern},state.ilike.${pattern},equipment.ilike.${pattern}`
    );
  }

  q = filters.hotOnly
    ? q.order("hot_score", { ascending: false })
    : q.order("featured", { ascending: false }).order("created_at", { ascending: false });
  const { data, error, count } = await q.range(from, to);
  if (error) throw error;

  const items = ((data ?? []) as unknown as ListingCardRow[]).map((row) => rowToCard(row, viewer));
  return toPaginated(items, count, page, pageSize);
}

export async function fetchListingCardById(id: number, viewer: MarketplaceViewer = "carrier"): Promise<DriverCard | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("driver_listings")
    .select(LISTING_CARD_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToCard(data as unknown as ListingCardRow, viewer) : null;
}

/** Full driver profile — use only on detail page */
export async function fetchListingById(id: number, viewer: MarketplaceViewer = "carrier"): Promise<Driver | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("driver_listings")
    .select(LISTING_DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToDriver(data as unknown as ListingDetailRow, viewer) : null;
}

export async function fetchHotListings(viewer: MarketplaceViewer = "carrier"): Promise<HotListing[]> {
  if (!supabase) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase
    .from("driver_listings")
    .select("id, first_name, last_name, years_exp, months_exp, state, route_pref, equipment, hot_score, price, carrier_price")
    .eq("status", "active")
    .not("hot_score", "is", null)
    .gte("hot_score", 80)
    .order("hot_score", { ascending: false })
    .limit(6);
  if (viewer === "carrier") {
    q = q.not("carrier_price", "is", null).gt("carrier_price", 0);
  }
  const { data, error } = await q;
  if (error) throw error;
  type HotRow = {
    id: number;
    first_name: string;
    last_name: string;
    years_exp: number;
    months_exp?: number;
    state: string;
    route_pref: string;
    equipment: string;
    hot_score: number | null;
    price: number;
    carrier_price: number | null;
  };
  return ((data ?? []) as HotRow[]).map((r, i) => ({
    id: r.id,
    name: `${r.first_name} ${r.last_name.charAt(0)}.`,
    exp: formatDriverExperienceShort(r.years_exp, r.months_exp ?? 0),
    state: r.state,
    route: r.route_pref,
    trailer: r.equipment,
    score: r.hot_score ?? 0,
    price: viewer === "carrier" ? (r.carrier_price ?? 0) : r.price,
    hot: i === 0
  }));
}

export async function fetchPurchasedIds(): Promise<Set<number>> {
  if (!supabase) return new Set();
  const { data, error } = await supabase
    .from("purchases")
    .select("listing_id")
    .eq("buyer_company_id", getActiveCompanyId());
  if (error) throw error;
  return new Set((data ?? []).map((p) => p.listing_id));
}

export async function fetchReservedIds(): Promise<Set<number>> {
  if (!supabase) return new Set();
  const { data, error } = await supabase
    .from("reservations")
    .select("listing_id")
    .eq("buyer_company_id", getActiveCompanyId());
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.listing_id));
}

export type PurchaseRow = {
  id: string;
  listing_id: number;
  amount: number;
  contact_status: string;
  recruit_status: string;
  notes: string;
  purchased_at: string;
  driver_listings: ListingCardRow | null;
};

export async function fetchPurchasesPage(
  { page = 1, pageSize = DEFAULT_PAGE_SIZE }: PageParams = {}
): Promise<Paginated<PurchaseRow>> {
  if (!supabase) return toPaginated([], 0, page, pageSize);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data: purchases, error, count } = await supabase
    .from("purchases")
    .select("id, listing_id, amount, contact_status, recruit_status, notes, purchased_at", { count: "exact" })
    .eq("buyer_company_id", getActiveCompanyId())
    .order("purchased_at", { ascending: false })
    .range(from, to);
  if (error) throw error;
  if (!purchases?.length) return toPaginated([], count, page, pageSize);

  const listingIds = purchases.map((p) => p.listing_id);
  const { data: listings, error: listErr } = await supabase
    .from("driver_listings")
    .select(LISTING_CARD_SELECT)
    .in("id", listingIds);
  if (listErr) throw listErr;

  const listingMap = new Map(((listings ?? []) as unknown as ListingCardRow[]).map((l) => [l.id, l]));
  const items = purchases.map((p) => ({
    ...p,
    driver_listings: listingMap.get(p.listing_id) ?? null
  }));
  return toPaginated(items, count, page, pageSize);
}

export async function purchaseListing(listingId: number, amount: number): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const dealId = `DL-${Date.now().toString().slice(-4)}`;
  const { data: listing, error: listingErr } = await supabase
    .from("driver_listings")
    .select("cdl_class, equipment, state, seller_company_id")
    .eq("id", listingId)
    .single();
  if (listingErr || !listing) throw new Error("Listing not found");

  const { error: purchaseErr } = await supabase.from("purchases").insert({
    listing_id: listingId,
    buyer_company_id: getActiveCompanyId(),
    amount
  });
  if (purchaseErr) throw purchaseErr;

  const sellerId = listing.seller_company_id;
  if (sellerId) {
    await supabase.from("deals").insert({
      id: dealId,
      listing_id: listingId,
      buyer_company_id: getActiveCompanyId(),
      seller_company_id: sellerId,
      amount,
      status: "Contact Released",
      escrow_amount: amount
    });
  }

  await supabase.from("driver_listings").update({ status: "sold" }).eq("id", listingId);
  await supabase.from("activities").insert({
    activity_type: "sale",
    title: "Lead purchased",
    description: `${listing.cdl_class} ${listing.equipment} · ${listing.state} · $${amount}`,
    status_label: "SOLD",
    status_class: "sold"
  });
}

export async function reserveListing(listingId: number): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const expires = new Date();
  expires.setHours(expires.getHours() + 48);
  const { error } = await supabase.from("reservations").insert({
    listing_id: listingId,
    buyer_company_id: getActiveCompanyId(),
    fee: 25,
    expires_at: expires.toISOString()
  });
  if (error) throw error;
  await supabase.from("driver_listings").update({ status: "reserved" }).eq("id", listingId);
}

export async function updatePurchase(
  purchaseId: string,
  fields: Partial<{ contact_status: string; recruit_status: string; notes: string }>
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("purchases").update(fields).eq("id", purchaseId);
  if (error) throw error;
}

export type DealRow = {
  id: string;
  amount: number;
  status: string;
  escrow_amount: number;
  escrow_released: boolean;
  buyer_company_id: string;
  seller_company_id: string;
  listing_id: number | null;
  companies_buyer: { name: string } | null;
  companies_seller: { name: string } | null;
  driver_listings: { first_name: string; last_name: string } | null;
};

export async function fetchDealsPage(
  { page = 1, pageSize = DEFAULT_PAGE_SIZE }: PageParams = {}
): Promise<Paginated<DealRow>> {
  if (!supabase) return toPaginated([], 0, page, pageSize);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const companyId = getActiveCompanyId();
  const { data: deals, error, count } = await supabase
    .from("deals")
    .select("*", { count: "exact" })
    .or(`buyer_company_id.eq.${companyId},seller_company_id.eq.${companyId}`)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw error;
  if (!deals?.length) return toPaginated([], count, page, pageSize);

  const listingIds = deals.map((d) => d.listing_id).filter((id): id is number => id != null);
  const companyIds = [...new Set(deals.flatMap((d) => [d.buyer_company_id, d.seller_company_id]))];

  const [{ data: companies }, { data: listings }] = await Promise.all([
    supabase.from("companies").select("id, name").in("id", companyIds),
    listingIds.length
      ? supabase.from("driver_listings").select("id, first_name, last_name").in("id", listingIds)
      : Promise.resolve({ data: [] as { id: number; first_name: string; last_name: string }[] })
  ]);

  const companyMap = new Map((companies ?? []).map((c) => [c.id, c]));
  const listingMap = new Map((listings ?? []).map((l) => [l.id, l]));
  const items = deals.map((d) => ({
    id: d.id,
    amount: d.amount,
    status: d.status,
    escrow_amount: d.escrow_amount,
    escrow_released: d.escrow_released,
    buyer_company_id: d.buyer_company_id,
    seller_company_id: d.seller_company_id,
    listing_id: d.listing_id,
    companies_buyer: companyMap.get(d.buyer_company_id) ? { name: companyMap.get(d.buyer_company_id)!.name } : null,
    companies_seller: companyMap.get(d.seller_company_id) ? { name: companyMap.get(d.seller_company_id)!.name } : null,
    driver_listings: d.listing_id && listingMap.get(d.listing_id)
      ? { first_name: listingMap.get(d.listing_id)!.first_name, last_name: listingMap.get(d.listing_id)!.last_name }
      : null
  }));
  return toPaginated(items, count, page, pageSize);
}

export async function updateDealStatus(dealId: string, status: string, escrowReleased = false): Promise<void> {
  if (!supabase) return;
  const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (escrowReleased) updates.escrow_released = true;
  const { error } = await supabase.from("deals").update(updates).eq("id", dealId);
  if (error) throw error;
}

export async function fetchDealStats(period?: DashboardPeriod) {
  if (!supabase) return { inEscrow: 0, pendingPayment: 0, awaiting: 0, completed: 0, activeOngoing: 0 };
  const companyId = getActiveCompanyId();
  const { data: allDeals } = await supabase
    .from("deals")
    .select("status, escrow_amount, escrow_released, updated_at, created_at, hiring_stage")
    .or(`buyer_company_id.eq.${companyId},seller_company_id.eq.${companyId}`);
  const deals = allDeals ?? [];
  const completedInPeriod = period
    ? deals.filter(
        (d) => d.status === "Completed" && d.updated_at && d.updated_at >= periodSince(period)
      ).length
    : deals.filter((d) => d.status === "Completed").length;
  const activeOngoing = deals.filter(
    (d) => d.status !== "Completed" && d.hiring_stage !== "completed"
  ).length;
  return {
    inEscrow: deals.filter((d) => d.escrow_amount > 0 && !d.escrow_released).reduce((s, d) => s + d.escrow_amount, 0),
    pendingPayment: deals.filter((d) => d.status === "Pending Payment").length,
    awaiting: deals.filter((d) => ["Contact Released", "Orientation Scheduled", "Hired Confirmed"].includes(d.status)).length,
    completed: completedInPeriod,
    activeOngoing
  };
}

export type DisputeRow = {
  id: string;
  deal_id: string;
  reason: string;
  description: string;
  admin_status: string;
  resolution: string;
  filed_at: string;
  evidence_name: string | null;
  evidence_path: string | null;
  companies: { name: string } | null;
};

export async function fetchDisputesPage(
  { page = 1, pageSize = DEFAULT_PAGE_SIZE }: PageParams = {}
): Promise<Paginated<DisputeRow>> {
  if (!supabase) return toPaginated([], 0, page, pageSize);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const companyId = getActiveCompanyId();
  const { data: disputes, error, count } = await supabase
    .from("disputes")
    .select("id, deal_id, reason, description, admin_status, resolution, filed_at, filed_by_company_id, evidence_name, evidence_path", { count: "exact" })
    .eq("filed_by_company_id", companyId)
    .order("filed_at", { ascending: false })
    .range(from, to);
  if (error) throw error;
  if (!disputes?.length) return toPaginated([], count, page, pageSize);

  const companyIds = [...new Set(disputes.map((d) => d.filed_by_company_id))];
  const { data: companies } = await supabase.from("companies").select("id, name").in("id", companyIds);
  const companyMap = new Map((companies ?? []).map((c) => [c.id, c]));

  const items: DisputeRow[] = disputes.map((d) => ({
    id: d.id,
    deal_id: d.deal_id,
    reason: d.reason,
    description: d.description,
    admin_status: d.admin_status,
    resolution: d.resolution,
    filed_at: d.filed_at,
    evidence_name: d.evidence_name ?? null,
    evidence_path: d.evidence_path ?? null,
    companies: companyMap.get(d.filed_by_company_id) ? { name: companyMap.get(d.filed_by_company_id)!.name } : null
  }));
  return toPaginated(items, count, page, pageSize);
}

/** Unpaginated count for dashboard badges */
export async function fetchOpenDisputeCount(): Promise<number> {
  if (!supabase) return 0;
  const companyId = getActiveCompanyId();
  const { count, error } = await supabase
    .from("disputes")
    .select("id", { count: "exact", head: true })
    .eq("filed_by_company_id", companyId)
    .neq("admin_status", "Resolved");
  if (error) throw error;
  return count ?? 0;
}

export async function createDispute(
  dealId: string,
  reason: string,
  description: string,
  evidence?: { name: string; path: string }
): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const id = `DSP-${Date.now().toString().slice(-4)}`;
  const { error } = await supabase.from("disputes").insert({
    id,
    deal_id: dealId,
    reason,
    description,
    filed_by_company_id: getActiveCompanyId(),
    evidence_name: evidence?.name ?? null,
    evidence_path: evidence?.path ?? null
  });
  if (error) throw error;
}

export async function resolveDispute(disputeId: string, resolution: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("disputes").update({
    admin_status: "Resolved",
    resolution
  }).eq("id", disputeId);
  if (error) throw error;
}

export type ConversationSummary = {
  id: string;
  subject: string;
  last_message_at: string;
  is_support: boolean;
  deal_id: string | null;
  buyer_company_id?: string;
  seller_company_id?: string | null;
  channel_type?: string;
  companies: { name: string } | null;
  preview?: string;
  driver_label?: string | null;
  admin_name?: string | null;
  admin_avatar_url?: string | null;
};

export type MessageRow = {
  id: string;
  direction: string;
  body: string;
  created_at: string;
  sender_company_id?: string | null;
  attachment_name?: string | null;
  attachment_path?: string | null;
  attachment_url?: string | null;
};

const MESSAGE_SELECT =
  "id, direction, body, created_at, sender_company_id, attachment_name, attachment_path";

export async function fetchConversationsPage(
  { page = 1, pageSize = DEFAULT_PAGE_SIZE, accountType }: PageParams & { accountType?: AccountType } = {}
): Promise<Paginated<ConversationSummary>> {
  if (!supabase) return toPaginated([], 0, page, pageSize);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const companyId = getActiveCompanyId();
  let query = supabase
    .from("conversations")
    .select(
      `id, subject, last_message_at, is_support, deal_id, buyer_company_id, seller_company_id, channel_type,
      companies:companies!conversations_seller_company_id_fkey (name)`,
      { count: "exact" }
    )
    .eq("buyer_company_id", companyId);

  if (accountType === "carrier") {
    query = query.eq("channel_type", "carrier_admin");
  } else if (accountType === "agency" || accountType === "solo_recruiter") {
    query = query.eq("channel_type", "recruiter_admin");
  } else {
    query = query.in("channel_type", ["carrier_admin", "recruiter_admin"]);
  }

  const { data, error, count } = await query
    .order("last_message_at", { ascending: false })
    .range(from, to);
  if (error) throw error;

  const rawItems = (data ?? []).map((c) => ({
    ...c,
    companies: unwrapRelation(c.companies)
  })) as ConversationSummary[];

  const dealIds = [...new Set(rawItems.map((c) => c.deal_id).filter(Boolean))] as string[];
  const dealMeta = new Map<string, { driver_label: string; admin_name: string | null; admin_avatar_url: string | null }>();

  if (dealIds.length) {
    const { data: deals } = await supabase
      .from("deals")
      .select("id, listing_id, driver_listings ( first_name, last_name, assigned_admin_id )")
      .in("id", dealIds);

type ListingMeta = { first_name: string; last_name: string; assigned_admin_id: string | null };

    const adminIds = new Set<string>();
    for (const d of deals ?? []) {
      const listing = unwrapRelation(d.driver_listings as ListingMeta | ListingMeta[] | null);
      if (listing?.assigned_admin_id) adminIds.add(listing.assigned_admin_id);
    }

    const adminMap = new Map<string, { name: string; avatarUrl: string | null }>();
    if (adminIds.size) {
      const { data: admins } = await supabase
        .from("registration_accounts")
        .select("id, email, profile_data")
        .in("id", [...adminIds]);
      for (const a of admins ?? []) {
        const profile = a.profile_data as { agencyName?: string; fullName?: string; companyName?: string };
        const name = profile.agencyName ?? profile.fullName ?? profile.companyName ?? a.email;
        adminMap.set(a.id, { name, avatarUrl: avatarUrlFromProfileData(profile) });
      }
    }

    for (const d of deals ?? []) {
      const listing = unwrapRelation(d.driver_listings as ListingMeta | ListingMeta[] | null);
      const admin = listing?.assigned_admin_id ? adminMap.get(listing.assigned_admin_id) : null;
      dealMeta.set(d.id, {
        driver_label: listing ? `${listing.first_name} ${listing.last_name.charAt(0)}.` : "Driver",
        admin_name: admin?.name ?? null,
        admin_avatar_url: admin?.avatarUrl ?? null
      });
    }
  }

  const items = rawItems.map((c) => {
    const meta = c.deal_id ? dealMeta.get(c.deal_id) : null;
    return {
      ...c,
      driver_label: meta?.driver_label ?? null,
      admin_name: meta?.admin_name ?? null,
      admin_avatar_url: meta?.admin_avatar_url ?? null
    };
  });

  return toPaginated(items, count, page, pageSize);
}

export async function fetchConversationMessages(conversationId: string): Promise<MessageRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("messages")
    .select(MESSAGE_SELECT)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return enrichMessagesWithAttachmentUrls(data ?? []);
}

export function subscribeMarketplaceListings(onChange: () => void): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel("marketplace-listings")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "driver_listings" },
      () => onChange()
    )
    .subscribe();
  return () => {
    if (supabase) void supabase.removeChannel(channel);
  };
}

export function subscribeConversationMessages(conversationId: string, onChange: () => void): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`conversation-messages-${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`
      },
      () => onChange()
    )
    .subscribe();
  return () => {
    if (supabase) void supabase.removeChannel(channel);
  };
}

export function isOwnInboxMessage(
  msg: MessageRow,
  myCompanyId: string,
  buyerCompanyId: string
): boolean {
  if (!myCompanyId) return msg.direction === "out";
  if (msg.sender_company_id) return msg.sender_company_id === myCompanyId;
  const amBuyer = myCompanyId === buyerCompanyId;
  return amBuyer ? msg.direction === "out" : msg.direction === "in";
}

export async function sendMessage(
  conversationId: string,
  body: string,
  attachment?: { name: string; path: string }
): Promise<MessageRow | null> {
  if (!supabase) return null;
  const companyId = getActiveCompanyId();
  const { data: conv } = await supabase
    .from("conversations")
    .select("buyer_company_id")
    .eq("id", conversationId)
    .single();
  const direction = conv?.buyer_company_id === companyId ? "out" : "in";
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_company_id: companyId,
      direction,
      body,
      attachment_name: attachment?.name ?? null,
      attachment_path: attachment?.path ?? null
    })
    .select(MESSAGE_SELECT)
    .single();
  if (error) throw error;
  await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversationId);
  const [enriched] = await enrichMessagesWithAttachmentUrls([data as MessageRow]);
  return enriched ?? null;
}

export async function sendConversationFile(
  conversationId: string,
  file: File
): Promise<MessageRow | null> {
  const uploaded = await uploadChatAttachment(file, `conversations/${conversationId}`);
  return sendMessage(conversationId, `Shared file: ${uploaded.name}`, {
    name: uploaded.name,
    path: uploaded.path
  });
}

export type SellerListingsTab = "active" | "reserved" | "sold" | "expired";

const SELLER_TAB_STATUSES: Record<SellerListingsTab, string[]> = {
  active: ["pending", "active", "paused"],
  reserved: ["hiring", "reserved"],
  sold: ["sold"],
  expired: ["expired"]
};

export type SellerListingRow = {
  id: number;
  first_name: string;
  last_name: string;
  state: string;
  equipment: string;
  price: number;
  views: number;
  status: string;
  driver_type: string;
};

export async function fetchSellerListingsPage(
  tab: SellerListingsTab,
  { page = 1, pageSize = DEFAULT_PAGE_SIZE }: PageParams = {}
): Promise<Paginated<SellerListingRow>> {
  if (!supabase) return toPaginated([], 0, page, pageSize);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const statuses = SELLER_TAB_STATUSES[tab];

  const { data, error, count } = await supabase
    .from("driver_listings")
    .select("id, first_name, last_name, state, equipment, price, views, status, driver_type", { count: "exact" })
    .eq("seller_company_id", getActiveCompanyId())
    .in("status", statuses)
    .order("updated_at", { ascending: false })
    .range(from, to);
  if (error) throw error;
  return toPaginated(data ?? [], count, page, pageSize);
}

export async function fetchSellerListingCounts() {
  if (!supabase) return { active: 0, reserved: 0, sold: 0, expired: 0 };
  const { data } = await supabase
    .from("driver_listings")
    .select("status")
    .eq("seller_company_id", getActiveCompanyId());
  const rows = data ?? [];
  return {
    active: rows.filter((r) => SELLER_TAB_STATUSES.active.includes(r.status)).length,
    reserved: rows.filter((r) => SELLER_TAB_STATUSES.reserved.includes(r.status)).length,
    sold: rows.filter((r) => r.status === "sold").length,
    expired: rows.filter((r) => r.status === "expired").length
  };
}

export async function fetchSellerReservations() {
  if (!supabase) return [];
  const { data: sellerListings } = await supabase
    .from("driver_listings")
    .select("id, first_name, last_name, price")
    .eq("seller_company_id", getActiveCompanyId());
  const listingIds = (sellerListings ?? []).map((l) => l.id);
  if (!listingIds.length) return [];

  const [{ data: reservations, error }, { data: companies }] = await Promise.all([
    supabase.from("reservations").select("expires_at, fee, listing_id, buyer_company_id").in("listing_id", listingIds),
    supabase.from("companies").select("id, name")
  ]);
  if (error) throw error;
  const listingMap = new Map((sellerListings ?? []).map((l) => [l.id, l]));
  const companyMap = new Map((companies ?? []).map((c) => [c.id, c]));
  return (reservations ?? []).map((r) => ({
    expires_at: r.expires_at,
    fee: r.fee,
    driver_listings: listingMap.get(r.listing_id) ?? null,
    companies: companyMap.get(r.buyer_company_id) ? { name: companyMap.get(r.buyer_company_id)!.name } : null
  }));
}

export async function updateListingPrice(listingId: number, price: number): Promise<void> {
  if (!supabase) return;
  const { data: listing, error: fetchErr } = await supabase
    .from("driver_listings")
    .select("driver_type")
    .eq("id", listingId)
    .single();
  if (fetchErr || !listing) throw fetchErr ?? new Error("Listing not found");

  const capError = validateRecruiterListPrice(price, listing.driver_type ?? "Owner Operator");
  if (capError) throw new Error(capError);

  const pricing = computeListingPricing(price, 0);
  const { error } = await supabase.from("driver_listings").update({
    price: pricing.listPrice,
    platform_fee: pricing.platformFee,
    net_payout: pricing.netPayout,
    carrier_price: null,
    admin_markup: 0,
    status: "pending",
    updated_at: new Date().toISOString()
  }).eq("id", listingId);
  if (error) throw error;
  await autoAssignListing(listingId);
}

export async function updateListingStatus(listingId: number, status: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("driver_listings").update({ status, updated_at: new Date().toISOString() }).eq("id", listingId);
  if (error) throw error;
}

export async function expireListing(listingId: number): Promise<void> {
  return updateListingStatus(listingId, "expired");
}

export type NewListingInput = {
  firstName: string;
  lastName: string;
  state: string;
  phone: string;
  email?: string;
  cdlClass: string;
  cdlNumber?: string;
  yearsExp: number;
  monthsExp: number;
  scoreFlag: ScoreFlag;
  endorsements: string[];
  availableDate: string;
  equipment: string;
  routePref: string;
  notes: string;
  desiredWeeklyPay: string;
  weeksOutPreference: string;
  maxDispatchFeePct?: number | null;
  companyExpectations?: string;
  price: number;
  driverType: string;
  listingDurationDays?: number;
  documents?: string[];
};

export type SellerListingDetail = {
  id: number;
  first_name: string;
  last_name: string;
  state: string;
  phone: string;
  email: string | null;
  cdl_class: string;
  cdl_number: string | null;
  years_exp: number;
  months_exp: number;
  score_flag: ScoreFlag;
  endorsements: string[] | null;
  available_date: string;
  equipment: string;
  route_pref: string;
  notes: string | null;
  desired_weekly_pay: string | null;
  weeks_out_preference: string | null;
  max_dispatch_fee_pct: number | null;
  company_expectations: string | null;
  price: number;
  driver_type: string;
  listing_duration_days: number | null;
  documents: string[] | null;
  status: string;
};

export type UpdateListingInput = {
  firstName: string;
  lastName: string;
  state: string;
  phone: string;
  email?: string;
  cdlClass: string;
  cdlNumber?: string;
  yearsExp: number;
  monthsExp: number;
  scoreFlag: ScoreFlag;
  endorsements: string[];
  availableDate: string;
  equipment: string;
  routePref: string;
  notes: string;
  desiredWeeklyPay: string;
  weeksOutPreference: string;
  maxDispatchFeePct?: number | null;
  companyExpectations?: string;
  price: number;
  driverType: string;
  listingDurationDays?: number;
  documents?: string[];
};

export async function fetchSellerListingDetail(listingId: number): Promise<SellerListingDetail | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("driver_listings")
    .select(
      "id, first_name, last_name, state, phone, email, cdl_class, cdl_number, years_exp, months_exp, score_flag, endorsements, available_date, equipment, route_pref, notes, desired_weekly_pay, weeks_out_preference, max_dispatch_fee_pct, company_expectations, price, driver_type, listing_duration_days, documents, status"
    )
    .eq("id", listingId)
    .eq("seller_company_id", getActiveCompanyId())
    .maybeSingle();
  if (error) throw error;
  return data as SellerListingDetail | null;
}

export type UpdateListingMeta = {
  previousStatus: string;
  previousPrice: number;
};

export async function updateListing(
  listingId: number,
  input: UpdateListingInput,
  meta?: UpdateListingMeta
): Promise<{ reapprovalRequired: boolean }> {
  if (!supabase) throw new Error("Supabase not configured");
  const capError = validateRecruiterListPrice(input.price, input.driverType);
  if (capError) throw new Error(capError);

  const durationDays = Math.min(7, Math.max(1, input.listingDurationDays ?? 7));
  const pricing = computeListingPricing(input.price, 0);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + durationDays);

  const reapprovalRequired = meta ? input.price !== meta.previousPrice : true;
  const keepLiveStatus = meta && !reapprovalRequired && ["active", "paused"].includes(meta.previousStatus);
  const nextStatus = keepLiveStatus ? meta.previousStatus : "pending";

  const payload: Record<string, unknown> = {
    first_name: input.firstName,
    last_name: input.lastName,
    state: input.state,
    phone: input.phone,
    email: input.email?.trim() || null,
    cdl_class: input.cdlClass,
    cdl_number: input.cdlNumber?.trim() || null,
    years_exp: input.yearsExp,
    months_exp: input.monthsExp,
    score_flag: input.scoreFlag,
    endorsements: input.endorsements,
    available_date: input.availableDate,
    equipment: input.equipment,
    route_pref: input.routePref,
    notes: input.notes,
    desired_weekly_pay: input.desiredWeeklyPay.trim(),
    weeks_out_preference: input.weeksOutPreference.trim(),
    max_dispatch_fee_pct: input.maxDispatchFeePct ?? null,
    company_expectations: input.companyExpectations?.trim() || null,
    price: pricing.listPrice,
    platform_fee: pricing.platformFee,
    net_payout: pricing.netPayout,
    driver_type: input.driverType,
    listing_duration_days: durationDays,
    expires_at: expiresAt.toISOString(),
    documents: input.documents?.length ? input.documents : ["CDL Copy"],
    status: nextStatus,
    updated_at: new Date().toISOString()
  };

  if (reapprovalRequired) {
    payload.carrier_price = null;
    payload.admin_markup = 0;
  }

  const { data, error } = await supabase
    .from("driver_listings")
    .update(payload)
    .eq("id", listingId)
    .eq("seller_company_id", getActiveCompanyId())
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Listing not found or you do not have permission to edit it");

  if (reapprovalRequired) {
    await autoAssignListing(listingId);
  }

  return { reapprovalRequired };
}

export async function createListing(input: NewListingInput): Promise<number> {
  if (!supabase) throw new Error("Supabase not configured");
  const capError = validateRecruiterListPrice(input.price, input.driverType);
  if (capError) throw new Error(capError);

  await assertCanCreateListing();

  const pricing = computeListingPricing(input.price, 0);
  const durationDays = Math.min(7, Math.max(1, input.listingDurationDays ?? 7));
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + durationDays);

  const { data, error } = await supabase.from("driver_listings").insert({
    first_name: input.firstName,
    last_name: input.lastName,
    state: input.state,
    phone: input.phone,
    email: input.email?.trim() || null,
    cdl_class: input.cdlClass,
    cdl_number: input.cdlNumber?.trim() || null,
    years_exp: input.yearsExp,
    months_exp: input.monthsExp,
    score_flag: input.scoreFlag,
    endorsements: input.endorsements,
    available_date: input.availableDate,
    equipment: input.equipment,
    route_pref: input.routePref,
    notes: input.notes,
    desired_weekly_pay: input.desiredWeeklyPay.trim(),
    weeks_out_preference: input.weeksOutPreference.trim(),
    max_dispatch_fee_pct: input.maxDispatchFeePct ?? null,
    company_expectations: input.companyExpectations?.trim() || null,
    price: pricing.listPrice,
    platform_fee: pricing.platformFee,
    net_payout: pricing.netPayout,
    carrier_price: null,
    admin_markup: 0,
    driver_type: input.driverType,
    listing_duration_days: durationDays,
    expires_at: expiresAt.toISOString(),
    documents: input.documents?.length ? input.documents : ["CDL Copy"],
    seller_company_id: getActiveCompanyId(),
    status: "pending",
    verified: false,
    consent_verified: true
  }).select("id").single();
  if (error) throw new Error(error.message);
  await autoAssignListing(data.id);
  await supabase.from("activities").insert({
    activity_type: "list",
    title: "New listing submitted",
    description: `${input.cdlClass} ${input.equipment} · ${input.state} · $${input.price}`,
    status_label: "LISTED",
    status_class: "listed"
  });
  return data.id;
}

export async function fetchPendingApprovalsPage(
  { page = 1, pageSize = DEFAULT_PAGE_SIZE }: PageParams = {}
) {
  if (!supabase) return toPaginated([], 0, page, pageSize);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("driver_listings")
    .select(`id, first_name, last_name, state, price, score_flag, consent_verified,
      companies (name)`, { count: "exact" })
    .eq("status", "pending")
    .order("id")
    .range(from, to);
  if (error) throw error;
  return toPaginated(data ?? [], count, page, pageSize);
}

export async function approveListing(listingId: number): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("driver_listings").update({ status: "active" }).eq("id", listingId);
  if (error) throw error;
}

export async function rejectListing(listingId: number): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("driver_listings").update({ status: "expired" }).eq("id", listingId);
  if (error) throw error;
}

export async function fetchActivities(period?: DashboardPeriod) {
  if (!supabase) return [];
  let q = supabase.from("activities").select("*").order("created_at", { ascending: false }).limit(6);
  if (period) q = q.gte("created_at", periodSince(period));
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function fetchFollowUps() {
  if (!supabase) return [];
  const { data, error } = await supabase.from("follow_ups").select("*").eq("company_id", getActiveCompanyId());
  if (error) throw error;
  return data ?? [];
}

export async function fetchCategoryStats() {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("driver_listings")
    .select("driver_type, price")
    .in("status", ["active", "reserved", "pending"]);
  if (error) throw error;
  if (!data?.length) return [];

  const totals = new Map<string, { count: number; priceSum: number }>();
  for (const row of data) {
    const key = row.driver_type || "Other";
    const entry = totals.get(key) ?? { count: 0, priceSum: 0 };
    entry.count += 1;
    entry.priceSum += row.price ?? 0;
    totals.set(key, entry);
  }

  const grandTotal = data.length;
  return [...totals.entries()]
    .map(([name, stats], index) => {
      const share = Math.round((stats.count / grandTotal) * 100);
      const rate_class = share >= 35 ? "high" : share >= 18 ? "mid" : "low";
      return {
        id: `cat-${index}`,
        name,
        listings_count: stats.count,
        avg_price: stats.count ? Math.round(stats.priceSum / stats.count) : 0,
        sell_rate: share,
        rate_class
      };
    })
    .sort((a, b) => b.listings_count - a.listings_count);
}

export async function fetchSellerStats() {
  if (!supabase) return [];

  const since = new Date();
  since.setDate(1);
  since.setHours(0, 0, 0, 0);
  const sinceIso = since.toISOString();

  const { data: deals, error } = await supabase
    .from("deals")
    .select("seller_company_id, amount, status, created_at")
    .gte("created_at", sinceIso);
  if (error) throw error;
  if (!deals?.length) return [];

  const bySeller = new Map<string, { sold: number; completed: number; revenue: number }>();
  for (const deal of deals) {
    const entry = bySeller.get(deal.seller_company_id) ?? { sold: 0, completed: 0, revenue: 0 };
    entry.sold += 1;
    if (deal.status === "Completed" || deal.status === "Hired Confirmed") {
      entry.completed += 1;
      entry.revenue += deal.amount ?? 0;
    }
    bySeller.set(deal.seller_company_id, entry);
  }

  const sellerIds = [...bySeller.keys()];
  const { data: companies } = await supabase
    .from("companies")
    .select("id, name, rating")
    .in("id", sellerIds);

  const companyMap = new Map((companies ?? []).map((c) => [c.id, c]));

  return [...bySeller.entries()]
    .map(([companyId, stats], index) => {
      const company = companyMap.get(companyId);
      const successRate = stats.sold ? Math.round((stats.completed / stats.sold) * 100) : 0;
      const rank_class = index === 0 ? "gold" : index === 1 ? "silver" : index === 2 ? "bronze" : "";
      return {
        id: companyId,
        company_id: companyId,
        rank_position: index + 1,
        sold_count: stats.sold,
        success_rate: successRate,
        revenue: stats.revenue,
        rank_class,
        companies: company ? { name: company.name, rating: company.rating } : { name: "—", rating: 4 }
      };
    })
    .sort((a, b) => b.sold_count - a.sold_count || b.revenue - a.revenue)
    .slice(0, 10)
    .map((row, index) => ({ ...row, rank_position: index + 1 }));
}

export async function fetchDashboardStats() {
  if (!supabase) return { available: 0, avgPrice: 0, verifiedPct: 0, classAOtr: 0 };

  const [{ count: available }, { count: verified }, { count: classAOtr }, priceResult] = await Promise.all([
    supabase
      .from("driver_listings")
      .select("id", { count: "exact", head: true })
      .in("status", ["active", "reserved"]),
    supabase
      .from("driver_listings")
      .select("id", { count: "exact", head: true })
      .in("status", ["active", "reserved"])
      .eq("verified", true),
    supabase
      .from("driver_listings")
      .select("id", { count: "exact", head: true })
      .in("status", ["active", "reserved"])
      .eq("cdl_class", "Class A")
      .eq("route_pref", "OTR"),
    supabase.from("driver_listings").select("price").in("status", ["active", "reserved"]).limit(1000)
  ]);

  const prices = priceResult.data ?? [];
  const avgPrice = prices.length ? Math.round(prices.reduce((s, r) => s + r.price, 0) / prices.length) : 0;
  const total = available ?? 0;
  const verifiedCount = verified ?? 0;

  return {
    available: total,
    avgPrice,
    verifiedPct: total ? Math.round((verifiedCount / total) * 100) : 0,
    classAOtr: classAOtr ?? 0
  };
}

export async function fetchDealsForSelect(): Promise<{ id: string }[]> {
  if (!supabase) return [];
  const companyId = getActiveCompanyId();
  const { data, error } = await supabase
    .from("deals")
    .select("id")
    .or(`buyer_company_id.eq.${companyId},seller_company_id.eq.${companyId}`)
    .not("status", "eq", "Completed")
    .neq("hiring_stage", "completed");
  if (error) throw error;
  return data ?? [];
}
