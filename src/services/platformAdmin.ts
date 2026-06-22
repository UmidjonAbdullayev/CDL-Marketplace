import { supabase } from "../lib/supabase";
import type { AdminRole } from "../types/registration";
import { hashPassword } from "./registration";

export type PlatformAdmin = {
  id: string;
  email: string;
  name: string;
  admin_role: AdminRole;
  is_admin: boolean;
  created_at: string;
};

export type PendingListingApproval = {
  id: number;
  first_name: string;
  last_name: string;
  state: string;
  driver_type: string;
  price: number;
  platform_fee: number | null;
  net_payout: number | null;
  admin_markup: number | null;
  carrier_price: number | null;
  score_flag: string;
  consent_verified: boolean;
  assigned_admin_id: string | null;
  approval_notes: string | null;
  companies: { name: string } | { name: string }[] | null;
};

function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function fetchPlatformAdmins(): Promise<PlatformAdmin[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("registration_accounts")
    .select("id, email, profile_data, admin_role, is_admin, created_at")
    .in("admin_role", ["admin", "manager"])
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const profile = row.profile_data as { agencyName?: string; fullName?: string; companyName?: string };
    const name = profile.agencyName ?? profile.fullName ?? profile.companyName ?? row.email;
    return {
      id: row.id,
      email: row.email,
      name,
      admin_role: row.admin_role as AdminRole,
      is_admin: Boolean(row.is_admin),
      created_at: row.created_at
    };
  });
}

export async function createPlatformAdmin(
  email: string,
  password: string,
  name: string
): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const password_hash = await hashPassword(password);
  const normalized = email.trim().toLowerCase();
  const { error } = await supabase.from("registration_accounts").insert({
    account_type: "carrier",
    status: "active",
    email: normalized,
    password_hash,
    selected_plan: "pro_fleet",
    profile_data: {
      companyName: name,
      companyEmail: normalized,
      phone: "",
      website: "",
      mcNumber: "PLATFORM",
      dotNumber: "",
      specialization: "Platform Operations",
      serviceArea: "National",
      yearsInBusiness: "",
      address: "",
      city: "",
      state: "",
      zip: "",
      about: "CDL Exchange platform administrator"
    },
    policy_accepted: true,
    policy_accepted_at: new Date().toISOString(),
    policy_version: "1.0",
    is_admin: true,
    admin_role: "admin",
    mc_verified: true,
    profile_verified: true,
    suspended: false
  });
  if (error) throw error;
}

export async function assignListingToAdmin(listingId: number, adminId: string | null): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from("driver_listings")
    .update({ assigned_admin_id: adminId, updated_at: new Date().toISOString() })
    .eq("id", listingId);
  if (error) throw error;
}

export async function autoAssignListing(listingId: number): Promise<void> {
  if (!supabase) return;
  const db = supabase;
  const { data: admins } = await db
    .from("registration_accounts")
    .select("id")
    .eq("admin_role", "admin")
    .eq("suspended", false);
  if (!admins?.length) return;

  const counts = await Promise.all(
    admins.map(async (admin) => {
      const { count } = await db
        .from("driver_listings")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .eq("assigned_admin_id", admin.id);
      return { id: admin.id, count: count ?? 0 };
    })
  );
  counts.sort((a, b) => a.count - b.count);
  await assignListingToAdmin(listingId, counts[0]?.id ?? admins[0].id);
}

export async function fetchPendingApprovalsForAdmin(
  adminId: string,
  adminRole: AdminRole,
  page = 1,
  pageSize = 50
) {
  if (!supabase) return { items: [] as PendingListingApproval[], total: 0, page, pageSize, totalPages: 1 };

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from("driver_listings")
    .select(
      `id, first_name, last_name, state, driver_type, price, platform_fee, net_payout,
      admin_markup, carrier_price, score_flag, consent_verified, assigned_admin_id, approval_notes,
      companies (name)`,
      { count: "exact" }
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (adminRole === "admin") {
    q = q.eq("assigned_admin_id", adminId);
  }

  const { data, error, count } = await q.range(from, to);
  if (error) throw error;

  const total = count ?? 0;
  return {
    items: (data ?? []) as PendingListingApproval[],
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  };
}

export async function approveListingWithCarrierPrice(
  listingId: number,
  adminMarkup: number,
  notes: string,
  reviewerId: string
): Promise<void> {
  if (!supabase) return;
  const { data: listing, error: fetchErr } = await supabase
    .from("driver_listings")
    .select("price, platform_fee, net_payout")
    .eq("id", listingId)
    .single();
  if (fetchErr || !listing) throw fetchErr ?? new Error("Listing not found");

  const markup = Math.max(0, Math.round(adminMarkup));
  const carrierPrice = listing.price + markup;

  const { error } = await supabase
    .from("driver_listings")
    .update({
      status: "active",
      verified: true,
      admin_markup: markup,
      carrier_price: carrierPrice,
      platform_fee: listing.platform_fee ?? Math.round(listing.price * 0.15),
      net_payout: listing.net_payout ?? listing.price - Math.round(listing.price * 0.15),
      approval_notes: notes || null,
      assigned_admin_id: reviewerId,
      updated_at: new Date().toISOString()
    })
    .eq("id", listingId);
  if (error) throw error;

  await supabase.from("activities").insert({
    activity_type: "list",
    title: "Listing approved for carriers",
    description: `Carrier price set to $${carrierPrice} (markup $${markup})`,
    status_label: "APPROVED",
    status_class: "listed"
  });
}

export function adminDisplayName(admin: PlatformAdmin): string {
  return admin.name || admin.email;
}

export function unwrapCompanyName(companies: PendingListingApproval["companies"]): string {
  return unwrapRelation(companies)?.name ?? "—";
}

export type PlatformOngoingDeal = {
  id: string;
  listing_id: number | null;
  amount: number;
  status: string;
  hiring_stage: string;
  buyer_name: string;
  seller_name: string;
  driver_label: string;
  driver_full_name: string;
  driver_type: string;
  list_price: number | null;
  carrier_price: number;
  assigned_admin_id: string | null;
  assigned_admin_name: string;
  buyer_signed_at: string | null;
  seller_signed_at: string | null;
  created_at: string;
  updated_at: string;
  carrier_conversation_id: string | null;
  recruiter_conversation_id: string | null;
};

function mapPlatformDealRows(
  deals: {
    id: string;
    listing_id: number | null;
    amount: number;
    status: string;
    hiring_stage: string;
    buyer_company_id: string;
    seller_company_id: string;
    buyer_signed_at: string | null;
    seller_signed_at: string | null;
    created_at: string;
    updated_at: string;
  }[],
  listings: {
    id: number;
    first_name: string;
    last_name: string;
    driver_type: string;
    price: number;
    carrier_price: number | null;
    assigned_admin_id: string | null;
  }[],
  companies: { id: string; name: string }[],
  convs: { id: string; deal_id: string | null; channel_type: string }[],
  admins: PlatformAdmin[]
): PlatformOngoingDeal[] {
  const companyMap = new Map(companies.map((c) => [c.id, c.name]));
  const listingMap = new Map(listings.map((l) => [l.id, l]));
  const adminMap = new Map(admins.map((a) => [a.id, a.name]));
  const convByDeal = new Map<string, { carrier?: string; recruiter?: string }>();
  for (const c of convs) {
    if (!c.deal_id) continue;
    const entry = convByDeal.get(c.deal_id) ?? {};
    if (c.channel_type === "carrier_admin") entry.carrier = c.id;
    if (c.channel_type === "recruiter_admin") entry.recruiter = c.id;
    convByDeal.set(c.deal_id, entry);
  }

  return deals.map((d) => {
    const listing = d.listing_id ? listingMap.get(d.listing_id) : null;
    const assignedId = listing?.assigned_admin_id ?? null;
    const channels = convByDeal.get(d.id);
    return {
      id: d.id,
      listing_id: d.listing_id,
      amount: d.amount,
      status: d.status,
      hiring_stage: d.hiring_stage,
      buyer_name: companyMap.get(d.buyer_company_id) ?? "—",
      seller_name: companyMap.get(d.seller_company_id) ?? "—",
      driver_label: listing ? `${listing.first_name} ${listing.last_name.charAt(0)}.` : "—",
      driver_full_name: listing ? `${listing.first_name} ${listing.last_name}` : "—",
      driver_type: listing?.driver_type ?? "—",
      list_price: listing?.price ?? null,
      carrier_price: listing?.carrier_price ?? d.amount,
      assigned_admin_id: assignedId,
      assigned_admin_name: assignedId ? adminMap.get(assignedId) ?? "—" : "Unassigned",
      buyer_signed_at: d.buyer_signed_at,
      seller_signed_at: d.seller_signed_at,
      created_at: d.created_at,
      updated_at: d.updated_at,
      carrier_conversation_id: channels?.carrier ?? null,
      recruiter_conversation_id: channels?.recruiter ?? null
    };
  });
}

export function classifyDealBucket(deal: Pick<PlatformOngoingDeal, "status" | "hiring_stage" | "buyer_signed_at" | "seller_signed_at">): "active" | "on_hold" | "completed" {
  if (deal.status === "Completed" || deal.hiring_stage === "completed") return "completed";
  if (
    !deal.buyer_signed_at ||
    !deal.seller_signed_at ||
    deal.status.includes("Awaiting") ||
    deal.status.includes("Contract") ||
    deal.status === "Contract Pending"
  ) {
    return "on_hold";
  }
  return "active";
}

export async function fetchPlatformOngoingDeals(
  adminId: string,
  adminRole: AdminRole
): Promise<PlatformOngoingDeal[]> {
  const all = await fetchPlatformDealsDashboard(adminId, adminRole);
  return all.filter((d) => classifyDealBucket(d) !== "completed");
}

export async function fetchPlatformDealsDashboard(
  adminId: string,
  adminRole: AdminRole
): Promise<PlatformOngoingDeal[]> {
  if (!supabase) return [];

  const { data: deals, error } = await supabase
    .from("deals")
    .select("id, listing_id, amount, status, hiring_stage, buyer_company_id, seller_company_id, buyer_signed_at, seller_signed_at, created_at, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  if (!deals?.length) return [];

  const listingIds = deals.map((d) => d.listing_id).filter((id): id is number => id != null);
  const companyIds = [...new Set(deals.flatMap((d) => [d.buyer_company_id, d.seller_company_id]))];
  const dealIds = deals.map((d) => d.id);

  const [{ data: companies }, { data: listings }, { data: convs }, admins] = await Promise.all([
    supabase.from("companies").select("id, name").in("id", companyIds),
    listingIds.length
      ? supabase
          .from("driver_listings")
          .select("id, first_name, last_name, driver_type, price, carrier_price, assigned_admin_id")
          .in("id", listingIds)
      : Promise.resolve({ data: [] as { id: number; first_name: string; last_name: string; driver_type: string; price: number; carrier_price: number | null; assigned_admin_id: string | null }[] }),
    supabase.from("conversations").select("id, deal_id, channel_type").in("deal_id", dealIds),
    fetchPlatformAdmins()
  ]);

  const rows = mapPlatformDealRows(deals, listings ?? [], companies ?? [], convs ?? [], admins);
  return adminRole === "manager" ? rows : rows.filter((row) => row.assigned_admin_id === adminId);
}

export async function assignDealListingAdmin(listingId: number, adminId: string | null): Promise<void> {
  return assignListingToAdmin(listingId, adminId);
}

export type AdminChatInboxRow = {
  conversation_id: string;
  channel_type: "carrier_admin" | "recruiter_admin";
  deal_id: string;
  deal_status: string;
  hiring_stage: string;
  party_name: string;
  driver_label: string;
  assigned_admin_id: string | null;
  assigned_admin_name: string;
  last_message_at: string | null;
  updated_at: string;
};

export type AdminDealChatFilters = {
  adminId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
};

export async function fetchAdminDealChatInbox(
  viewerId: string,
  adminRole: AdminRole,
  filters: AdminDealChatFilters = {}
): Promise<AdminChatInboxRow[]> {
  if (!supabase) return [];

  const { data: deals, error } = await supabase
    .from("deals")
    .select("id, status, hiring_stage, buyer_company_id, seller_company_id, listing_id, updated_at")
    .not("status", "eq", "Completed")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  if (!deals?.length) return [];

  const listingIds = deals.map((d) => d.listing_id).filter((id): id is number => id != null);
  const companyIds = [...new Set(deals.flatMap((d) => [d.buyer_company_id, d.seller_company_id]))];

  const [{ data: listings }, { data: companies }, { data: convs }, admins] = await Promise.all([
    listingIds.length
      ? supabase.from("driver_listings").select("id, first_name, last_name, assigned_admin_id").in("id", listingIds)
      : Promise.resolve({ data: [] as { id: number; first_name: string; last_name: string; assigned_admin_id: string | null }[] }),
    supabase.from("companies").select("id, name").in("id", companyIds),
    supabase.from("conversations").select("id, deal_id, channel_type, last_message_at").in("channel_type", ["carrier_admin", "recruiter_admin"]),
    fetchPlatformAdmins()
  ]);

  const listingMap = new Map((listings ?? []).map((l) => [l.id, l]));
  const companyMap = new Map((companies ?? []).map((c) => [c.id, c.name]));
  const adminMap = new Map(admins.map((a) => [a.id, a.name]));
  const dealMap = new Map(deals.map((d) => [d.id, d]));

  let rows = (convs ?? [])
    .map((c) => {
      const deal = dealMap.get(c.deal_id!);
      if (!deal) return null;
      const listing = deal.listing_id ? listingMap.get(deal.listing_id) : null;
      const assignedId = listing?.assigned_admin_id ?? null;
      const isCarrier = c.channel_type === "carrier_admin";
      const partyId = isCarrier ? deal.buyer_company_id : deal.seller_company_id;
      const row: AdminChatInboxRow = {
        conversation_id: c.id,
        channel_type: c.channel_type as "carrier_admin" | "recruiter_admin",
        deal_id: deal.id,
        deal_status: deal.status,
        hiring_stage: deal.hiring_stage,
        party_name: companyMap.get(partyId) ?? "—",
        driver_label: listing ? `${listing.first_name} ${listing.last_name.charAt(0)}.` : "—",
        assigned_admin_id: assignedId,
        assigned_admin_name: assignedId ? (adminMap.get(assignedId) ?? "—") : "Unassigned",
        last_message_at: c.last_message_at,
        updated_at: deal.updated_at
      };
      return row;
    })
    .filter((r): r is AdminChatInboxRow => r != null);

  if (adminRole === "admin") {
    rows = rows.filter((r) => r.assigned_admin_id === viewerId);
  }
  if (filters.adminId) {
    rows = rows.filter((r) => r.assigned_admin_id === filters.adminId);
  }
  if (filters.status) {
    rows = rows.filter((r) => r.deal_status === filters.status || r.hiring_stage === filters.status);
  }
  if (filters.dateFrom) {
    rows = rows.filter((r) => r.updated_at >= filters.dateFrom!);
  }
  if (filters.dateTo) {
    rows = rows.filter((r) => r.updated_at <= `${filters.dateTo}T23:59:59`);
  }

  return rows.sort((a, b) => (b.last_message_at ?? b.updated_at).localeCompare(a.last_message_at ?? a.updated_at));
}
