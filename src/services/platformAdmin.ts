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
    account_type: "agency",
    status: "active",
    email: normalized,
    password_hash,
    profile_data: {
      agencyName: name,
      companyEmail: normalized,
      phone: "",
      website: "",
      contactPersonName: name,
      contactPersonRole: "Platform Admin",
      specialization: "Platform Operations",
      serviceArea: "National",
      yearsInBusiness: "",
      address: "",
      city: "",
      state: "",
      zip: ""
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
