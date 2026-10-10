import { supabase } from "../lib/supabase";
import { unwrapRelation } from "./marketplace";
import { computeListingPricing } from "../lib/listing-pricing";
import type { DriverType } from "../lib/driver-types";
import type { ScoreFlag } from "../types";

export const ADMIN_LISTING_STATUSES = [
  "draft",
  "pending",
  "active",
  "paused",
  "reserved",
  "hiring",
  "sold",
  "expired"
] as const;

export type AdminListingStatus = (typeof ADMIN_LISTING_STATUSES)[number];

export type AdminCompanyOption = {
  id: string;
  name: string;
  company_type: string;
};

export type AdminListingRecord = {
  id: number;
  first_name: string;
  last_name: string;
  state: string;
  years_exp: number;
  months_exp: number;
  cdl_class: string;
  equipment: string;
  endorsements: string[];
  available_date: string;
  score_flag: ScoreFlag;
  verified: boolean;
  featured: boolean;
  consent_verified: boolean;
  price: number;
  platform_fee: number | null;
  net_payout: number | null;
  carrier_price: number | null;
  admin_markup: number | null;
  seller_company_id: string;
  phone: string;
  email: string | null;
  cdl_number: string | null;
  documents: string[];
  notes: string;
  extra_information: string;
  route_pref: string;
  status: string;
  views: number;
  hot_score: number | null;
  driver_type: DriverType | string;
  listing_duration_days: number | null;
  expires_at: string | null;
  desired_weekly_pay: string | null;
  weeks_out_preference: string | null;
  max_dispatch_fee_pct: number | null;
  company_expectations: string | null;
  approval_notes: string | null;
  assigned_admin_id: string | null;
  created_at: string;
  updated_at: string;
  seller_name: string;
};

export type AdminListingInput = {
  seller_company_id: string;
  created_at: string;
  first_name: string;
  last_name: string;
  state: string;
  phone: string;
  email: string;
  cdl_class: string;
  cdl_number: string;
  years_exp: number;
  months_exp: number;
  score_flag: ScoreFlag;
  endorsements: string[];
  available_date: string;
  equipment: string;
  route_pref: string;
  driver_type: string;
  desired_weekly_pay: string;
  weeks_out_preference: string;
  max_dispatch_fee_pct: number | null;
  company_expectations: string;
  notes: string;
  extra_information: string;
  documents: string[];
  price: number;
  admin_markup: number;
  carrier_price: number | null;
  status: AdminListingStatus | string;
  featured: boolean;
  verified: boolean;
  consent_verified: boolean;
  listing_duration_days: number;
  expires_at: string | null;
  hot_score: number | null;
  approval_notes: string;
};

const ADMIN_LISTING_SELECT = `
  id, first_name, last_name, state, years_exp, months_exp, cdl_class, equipment, endorsements,
  available_date, score_flag, verified, featured, consent_verified, price, platform_fee, net_payout,
  carrier_price, admin_markup, seller_company_id, phone, email, cdl_number, documents, notes,
  extra_information, route_pref, status, views, hot_score, driver_type, listing_duration_days,
  expires_at, desired_weekly_pay, weeks_out_preference, max_dispatch_fee_pct, company_expectations,
  approval_notes, assigned_admin_id, created_at, updated_at,
  companies ( name )
`;

function mapRow(row: Record<string, unknown>): AdminListingRecord {
  const company = unwrapRelation(row.companies as { name: string } | { name: string }[] | null);
  return {
    id: Number(row.id),
    first_name: String(row.first_name ?? ""),
    last_name: String(row.last_name ?? ""),
    state: String(row.state ?? ""),
    years_exp: Number(row.years_exp ?? 0),
    months_exp: Number(row.months_exp ?? 0),
    cdl_class: String(row.cdl_class ?? "Class A"),
    equipment: String(row.equipment ?? "Dry Van"),
    endorsements: Array.isArray(row.endorsements) ? (row.endorsements as string[]) : [],
    available_date: String(row.available_date ?? "").slice(0, 10),
    score_flag: (row.score_flag as ScoreFlag) ?? "green",
    verified: Boolean(row.verified),
    featured: Boolean(row.featured),
    consent_verified: Boolean(row.consent_verified),
    price: Number(row.price ?? 0),
    platform_fee: row.platform_fee == null ? null : Number(row.platform_fee),
    net_payout: row.net_payout == null ? null : Number(row.net_payout),
    carrier_price: row.carrier_price == null ? null : Number(row.carrier_price),
    admin_markup: row.admin_markup == null ? null : Number(row.admin_markup),
    seller_company_id: String(row.seller_company_id ?? ""),
    phone: String(row.phone ?? ""),
    email: row.email == null ? null : String(row.email),
    cdl_number: row.cdl_number == null ? null : String(row.cdl_number),
    documents: Array.isArray(row.documents) ? (row.documents as string[]) : [],
    notes: String(row.notes ?? ""),
    extra_information: String(row.extra_information ?? ""),
    route_pref: String(row.route_pref ?? "OTR"),
    status: String(row.status ?? "draft"),
    views: Number(row.views ?? 0),
    hot_score: row.hot_score == null ? null : Number(row.hot_score),
    driver_type: String(row.driver_type ?? "Owner Operator"),
    listing_duration_days: row.listing_duration_days == null ? null : Number(row.listing_duration_days),
    expires_at: row.expires_at == null ? null : String(row.expires_at),
    desired_weekly_pay: row.desired_weekly_pay == null ? null : String(row.desired_weekly_pay),
    weeks_out_preference: row.weeks_out_preference == null ? null : String(row.weeks_out_preference),
    max_dispatch_fee_pct: row.max_dispatch_fee_pct == null ? null : Number(row.max_dispatch_fee_pct),
    company_expectations: row.company_expectations == null ? null : String(row.company_expectations),
    approval_notes: row.approval_notes == null ? null : String(row.approval_notes),
    assigned_admin_id: row.assigned_admin_id == null ? null : String(row.assigned_admin_id),
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
    seller_name: company?.name ?? "Unknown seller"
  };
}

function listingPayload(input: AdminListingInput): Record<string, unknown> {
  const listPrice = Math.max(0, Math.round(input.price));
  const markup = Math.max(0, Math.round(input.admin_markup));
  const pricing = computeListingPricing(listPrice, markup);
  const carrierPrice =
    input.carrier_price != null && Number.isFinite(input.carrier_price)
      ? Math.max(0, Math.round(input.carrier_price))
      : pricing.carrierPrice;
  const durationDays = Math.min(90, Math.max(1, input.listing_duration_days || 7));
  const live = input.status === "active";

  return {
    seller_company_id: input.seller_company_id,
    created_at: input.created_at,
    first_name: input.first_name.trim(),
    last_name: input.last_name.trim(),
    state: input.state,
    phone: input.phone.trim(),
    email: input.email.trim() || null,
    cdl_class: input.cdl_class,
    cdl_number: input.cdl_number.trim() || null,
    years_exp: Math.max(0, Math.round(input.years_exp)),
    months_exp: Math.max(0, Math.min(11, Math.round(input.months_exp))),
    score_flag: input.score_flag,
    endorsements: input.endorsements,
    available_date: input.available_date,
    equipment: input.equipment,
    route_pref: input.route_pref,
    driver_type: input.driver_type,
    desired_weekly_pay: input.desired_weekly_pay.trim() || null,
    weeks_out_preference: input.weeks_out_preference.trim() || null,
    max_dispatch_fee_pct: input.max_dispatch_fee_pct,
    company_expectations: input.company_expectations.trim() || null,
    notes: input.notes,
    extra_information: input.extra_information,
    documents: input.documents.length ? input.documents : ["CDL Copy"],
    price: listPrice,
    platform_fee: pricing.platformFee,
    net_payout: pricing.netPayout,
    admin_markup: markup,
    carrier_price: live ? carrierPrice : input.carrier_price,
    status: input.status,
    featured: input.featured,
    verified: live ? true : input.verified,
    consent_verified: input.consent_verified,
    listing_duration_days: durationDays,
    expires_at: input.expires_at,
    hot_score: input.hot_score,
    approval_notes: input.approval_notes.trim() || null,
    updated_at: new Date().toISOString()
  };
}

export async function fetchAdminCompanies(): Promise<AdminCompanyOption[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, company_type")
    .order("name");
  if (error) throw error;
  return (data ?? []) as AdminCompanyOption[];
}

export async function fetchAdminListings(status?: string): Promise<AdminListingRecord[]> {
  if (!supabase) return [];
  let q = supabase
    .from("driver_listings")
    .select(ADMIN_LISTING_SELECT)
    .order("created_at", { ascending: false });
  if (status && status !== "all") {
    q = q.eq("status", status);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function createAdminListing(input: AdminListingInput): Promise<number> {
  if (!supabase) throw new Error("Supabase not configured");
  if (!input.seller_company_id) throw new Error("Choose who this listing is posted by");
  if (!input.first_name.trim() || !input.last_name.trim()) throw new Error("Driver first and last name are required");
  if (!input.state) throw new Error("State is required");
  if (!input.available_date) throw new Error("Available date is required");

  const { data, error } = await supabase
    .from("driver_listings")
    .insert(listingPayload(input))
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as number;
}

export async function updateAdminListing(listingId: number, input: AdminListingInput): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  if (!input.seller_company_id) throw new Error("Choose who this listing is posted by");

  const { data, error } = await supabase
    .from("driver_listings")
    .update(listingPayload(input))
    .eq("id", listingId)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Listing not found");
}

export async function setAdminListingStatus(listingId: number, status: AdminListingStatus): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString()
  };
  if (status === "active") {
    patch.verified = true;
  }
  const { error } = await supabase.from("driver_listings").update(patch).eq("id", listingId);
  if (error) throw new Error(error.message);
}
