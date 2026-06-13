import { DEMO_BUYER_ID, DEMO_SELLER_ID } from "../lib/constants";
import type { DriverType } from "../lib/driver-types";
import { supabase } from "../lib/supabase";
import type { Driver, DriverCard, HotListing, Paginated, ScoreFlag } from "../types";

const NEW_LISTING_MS = 7 * 86400000;

export const DEFAULT_PAGE_SIZE = 50;

export type PageParams = { page?: number; pageSize?: number };

type ListingCardRow = {
  id: number;
  first_name: string;
  last_name: string;
  state: string;
  years_exp: number;
  cdl_class: string;
  equipment: string;
  available_date: string;
  score_flag: ScoreFlag;
  verified: boolean;
  price: number;
  driver_type: DriverType;
  featured: boolean;
  created_at: string;
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
  status: string;
  views: number;
  hot_score: number | null;
  seller_company_id: string;
};

export const LISTING_CARD_SELECT =
  "id, first_name, last_name, state, years_exp, cdl_class, equipment, available_date, score_flag, verified, price, hot_score, route_pref, driver_type, featured, created_at, companies (name, rating)";

export const LISTING_DETAIL_SELECT =
  `${LISTING_CARD_SELECT}, endorsements, phone, email, cdl_number, documents, notes, route_pref, status, views, hot_score, seller_company_id`;

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

export function rowToCard(row: ListingCardRowWithHot): DriverCard {
  const company = unwrapRelation(row.companies);
  const hotScore = row.hot_score ?? 0;
  const createdAt = row.created_at ?? new Date().toISOString();
  return {
    id: row.id,
    first: row.first_name,
    last: row.last_name,
    state: row.state,
    exp: row.years_exp,
    cdl: row.cdl_class,
    equip: row.equipment,
    avail: row.available_date,
    score: row.score_flag,
    verified: row.verified,
    price: row.price,
    seller: company?.name ?? "Unknown Seller",
    sellerRating: Number(company?.rating ?? 4),
    hotScore,
    isTrending: hotScore >= 80,
    driverType: row.driver_type ?? "Owner Operator",
    featured: row.featured ?? false,
    createdAt,
    isNew: Date.now() - new Date(createdAt).getTime() < NEW_LISTING_MS
  };
}

export function rowToDriver(row: ListingDetailRow): Driver {
  const card = rowToCard(row);
  return {
    ...card,
    endorse: row.endorsements ?? [],
    phone: row.phone,
    email: row.email,
    cdlNum: row.cdl_number,
    docs: row.documents ?? [],
    notes: row.notes ?? ""
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
  { page = 1, pageSize = DEFAULT_PAGE_SIZE }: PageParams = {}
): Promise<Paginated<DriverCard>> {
  if (!supabase) return toPaginated([], 0, page, pageSize);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase
    .from("driver_listings")
    .select(LISTING_CARD_SELECT, { count: "exact" })
    .in("status", ["active", "reserved"]);

  if (filters.state) q = q.eq("state", filters.state);
  if (filters.cdl) q = q.eq("cdl_class", filters.cdl);
  if (filters.exp) q = q.gte("years_exp", filters.exp);
  if (filters.equip) q = q.eq("equipment", filters.equip);
  if (filters.score) q = q.eq("score_flag", filters.score);
  if (filters.priceMin) q = q.gte("price", filters.priceMin);
  if (filters.priceMax && filters.priceMax < 99999) q = q.lte("price", filters.priceMax);
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

  const items = ((data ?? []) as unknown as ListingCardRow[]).map(rowToCard);
  return toPaginated(items, count, page, pageSize);
}

export async function fetchListingCardById(id: number): Promise<DriverCard | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("driver_listings")
    .select(LISTING_CARD_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToCard(data as unknown as ListingCardRow) : null;
}

/** Full driver profile — use only on detail page */
export async function fetchListingById(id: number): Promise<Driver | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("driver_listings")
    .select(LISTING_DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToDriver(data as unknown as ListingDetailRow) : null;
}

export async function fetchHotListings(): Promise<HotListing[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("driver_listings")
    .select("id, first_name, last_name, years_exp, state, route_pref, equipment, hot_score, price")
    .not("hot_score", "is", null)
    .gte("hot_score", 80)
    .order("hot_score", { ascending: false })
    .limit(6);
  if (error) throw error;
  return (data ?? []).map((r, i) => ({
    id: r.id,
    name: `${r.first_name} ${r.last_name.charAt(0)}.`,
    exp: `${r.years_exp} yrs`,
    state: r.state,
    route: r.route_pref,
    trailer: r.equipment,
    score: r.hot_score ?? 0,
    price: r.price,
    hot: i === 0
  }));
}

export async function fetchPurchasedIds(): Promise<Set<number>> {
  if (!supabase) return new Set();
  const { data, error } = await supabase
    .from("purchases")
    .select("listing_id")
    .eq("buyer_company_id", DEMO_BUYER_ID);
  if (error) throw error;
  return new Set((data ?? []).map((p) => p.listing_id));
}

export async function fetchReservedIds(): Promise<Set<number>> {
  if (!supabase) return new Set();
  const { data, error } = await supabase
    .from("reservations")
    .select("listing_id")
    .eq("buyer_company_id", DEMO_BUYER_ID);
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
    .eq("buyer_company_id", DEMO_BUYER_ID)
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
    buyer_company_id: DEMO_BUYER_ID,
    amount
  });
  if (purchaseErr) throw purchaseErr;

  const sellerId = listing.seller_company_id;
  if (sellerId) {
    await supabase.from("deals").insert({
      id: dealId,
      listing_id: listingId,
      buyer_company_id: DEMO_BUYER_ID,
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
    buyer_company_id: DEMO_BUYER_ID,
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

  const { data: deals, error, count } = await supabase
    .from("deals")
    .select("*", { count: "exact" })
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
  if (!supabase) return { inEscrow: 0, pendingPayment: 0, awaiting: 0, completed: 0 };
  const { data: allDeals } = await supabase
    .from("deals")
    .select("status, escrow_amount, escrow_released, updated_at, created_at");
  const deals = allDeals ?? [];
  const completedInPeriod = period
    ? deals.filter(
        (d) => d.status === "Completed" && d.updated_at && d.updated_at >= periodSince(period)
      ).length
    : deals.filter((d) => d.status === "Completed").length;
  return {
    inEscrow: deals.filter((d) => d.escrow_amount > 0 && !d.escrow_released).reduce((s, d) => s + d.escrow_amount, 0),
    pendingPayment: deals.filter((d) => d.status === "Pending Payment").length,
    awaiting: deals.filter((d) => ["Contact Released", "Orientation Scheduled", "Hired Confirmed"].includes(d.status)).length,
    completed: completedInPeriod
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
  companies: { name: string } | null;
};

export async function fetchDisputesPage(
  { page = 1, pageSize = DEFAULT_PAGE_SIZE }: PageParams = {}
): Promise<Paginated<DisputeRow>> {
  if (!supabase) return toPaginated([], 0, page, pageSize);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data: disputes, error, count } = await supabase
    .from("disputes")
    .select("id, deal_id, reason, description, admin_status, resolution, filed_at, filed_by_company_id", { count: "exact" })
    .order("filed_at", { ascending: false })
    .range(from, to);
  if (error) throw error;
  if (!disputes?.length) return toPaginated([], count, page, pageSize);

  const companyIds = [...new Set(disputes.map((d) => d.filed_by_company_id))];
  const { data: companies } = await supabase.from("companies").select("id, name").in("id", companyIds);
  const companyMap = new Map((companies ?? []).map((c) => [c.id, c]));

  const items = disputes.map((d) => ({
    ...d,
    companies: companyMap.get(d.filed_by_company_id) ? { name: companyMap.get(d.filed_by_company_id)!.name } : null
  }));
  return toPaginated(items, count, page, pageSize);
}

/** Unpaginated count for dashboard badges */
export async function fetchOpenDisputeCount(): Promise<number> {
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from("disputes")
    .select("id", { count: "exact", head: true })
    .neq("admin_status", "Resolved");
  if (error) throw error;
  return count ?? 0;
}

export async function createDispute(dealId: string, reason: string, description: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const id = `DSP-${Date.now().toString().slice(-4)}`;
  const { error } = await supabase.from("disputes").insert({
    id,
    deal_id: dealId,
    reason,
    description,
    filed_by_company_id: DEMO_BUYER_ID
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
  companies: { name: string } | null;
  preview?: string;
};

export type MessageRow = {
  id: string;
  direction: string;
  body: string;
  created_at: string;
};

export async function fetchConversationsPage(
  { page = 1, pageSize = DEFAULT_PAGE_SIZE }: PageParams = {}
): Promise<Paginated<ConversationSummary>> {
  if (!supabase) return toPaginated([], 0, page, pageSize);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("conversations")
    .select(
      `id, subject, last_message_at, is_support, deal_id,
      companies:companies!conversations_seller_company_id_fkey (name)`,
      { count: "exact" }
    )
    .eq("buyer_company_id", DEMO_BUYER_ID)
    .order("last_message_at", { ascending: false })
    .range(from, to);
  if (error) throw error;

  const items = (data ?? []).map((c) => ({
    ...c,
    companies: unwrapRelation(c.companies)
  })) as ConversationSummary[];

  return toPaginated(items, count, page, pageSize);
}

export async function fetchConversationMessages(conversationId: string): Promise<MessageRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("messages")
    .select("id, direction, body, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function sendMessage(conversationId: string, body: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_company_id: DEMO_BUYER_ID,
    direction: "out",
    body
  });
  if (error) throw error;
  await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversationId);
}

export type SellerListingRow = {
  id: number;
  first_name: string;
  last_name: string;
  state: string;
  equipment: string;
  price: number;
  views: number;
  status: string;
};

export async function fetchSellerListingsPage(
  status: string | undefined,
  { page = 1, pageSize = DEFAULT_PAGE_SIZE }: PageParams = {}
): Promise<Paginated<SellerListingRow>> {
  if (!supabase) return toPaginated([], 0, page, pageSize);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from("driver_listings")
    .select("id, first_name, last_name, state, equipment, price, views, status", { count: "exact" })
    .eq("seller_company_id", DEMO_SELLER_ID);
  if (status) q = q.eq("status", status);

  const { data, error, count } = await q.order("id").range(from, to);
  if (error) throw error;
  return toPaginated(data ?? [], count, page, pageSize);
}

export async function fetchSellerListingCounts() {
  if (!supabase) return { active: 0, reserved: 0, sold: 0, expired: 0 };
  const { data } = await supabase
    .from("driver_listings")
    .select("status")
    .eq("seller_company_id", DEMO_SELLER_ID);
  const rows = data ?? [];
  return {
    active: rows.filter((r) => r.status === "active").length,
    reserved: rows.filter((r) => r.status === "reserved").length,
    sold: rows.filter((r) => r.status === "sold").length,
    expired: rows.filter((r) => r.status === "expired").length
  };
}

export async function fetchSellerReservations() {
  if (!supabase) return [];
  const { data: sellerListings } = await supabase
    .from("driver_listings")
    .select("id, first_name, last_name, price")
    .eq("seller_company_id", DEMO_SELLER_ID);
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
  const { error } = await supabase.from("driver_listings").update({ price, updated_at: new Date().toISOString() }).eq("id", listingId);
  if (error) throw error;
}

export async function updateListingStatus(listingId: number, status: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("driver_listings").update({ status, updated_at: new Date().toISOString() }).eq("id", listingId);
  if (error) throw error;
}

export type NewListingInput = {
  firstName: string;
  lastName: string;
  state: string;
  phone: string;
  email: string;
  cdlClass: string;
  cdlNumber: string;
  yearsExp: number;
  scoreFlag: ScoreFlag;
  endorsements: string[];
  availableDate: string;
  equipment: string;
  routePref: string;
  notes: string;
  price: number;
  documents?: string[];
};

export async function createListing(input: NewListingInput): Promise<number> {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase.from("driver_listings").insert({
    first_name: input.firstName,
    last_name: input.lastName,
    state: input.state,
    phone: input.phone,
    email: input.email,
    cdl_class: input.cdlClass,
    cdl_number: input.cdlNumber,
    years_exp: input.yearsExp,
    score_flag: input.scoreFlag,
    endorsements: input.endorsements,
    available_date: input.availableDate,
    equipment: input.equipment,
    route_pref: input.routePref,
    notes: input.notes,
    price: input.price,
    documents: input.documents ?? ["CDL Copy"],
    seller_company_id: DEMO_SELLER_ID,
    status: "pending",
    verified: false,
    consent_verified: true
  }).select("id").single();
  if (error) throw error;
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
  let q = supabase.from("activities").select("*").order("created_at", { ascending: false }).limit(12);
  if (period) q = q.gte("created_at", periodSince(period));
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function fetchFollowUps() {
  if (!supabase) return [];
  const { data, error } = await supabase.from("follow_ups").select("*").eq("company_id", DEMO_BUYER_ID);
  if (error) throw error;
  return data ?? [];
}

export async function fetchCategoryStats() {
  if (!supabase) return [];
  const { data, error } = await supabase.from("category_stats").select("*").order("listings_count", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchSellerStats() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("seller_stats")
    .select(`id, rank_position, sold_count, success_rate, revenue, rank_class, companies (name, rating)`)
    .order("rank_position");
  if (error) throw error;
  return data ?? [];
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
  const { data, error } = await supabase
    .from("deals")
    .select("id")
    .eq("buyer_company_id", DEMO_BUYER_ID)
    .in("status", ["Contact Released", "Orientation Scheduled", "Hired Confirmed", "Disputed"]);
  if (error) throw error;
  return data ?? [];
}
