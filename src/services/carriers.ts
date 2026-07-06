import { carrierPlanLabel, searchCreditsForPlan } from "../lib/carrier-plans";
import { supabase } from "../lib/supabase";
import type { CarrierPlanId } from "../types/registration";
import type { CarrierCard, CarrierDirectoryFilters } from "../types/carriers";
import type { Paginated } from "../types";
import { DEFAULT_PAGE_SIZE } from "./marketplace";

type CarrierRow = {
  id: string;
  name: string;
  rating: number | string;
  leads_sold: number | null;
  registration_accounts: {
    selected_plan: CarrierPlanId | null;
    status: string;
    mc_verified: boolean;
    profile_verified: boolean;
    profile_data: Record<string, string> | null;
  } | {
    selected_plan: CarrierPlanId | null;
    status: string;
    mc_verified: boolean;
    profile_verified: boolean;
    profile_data: Record<string, string> | null;
  }[] | null;
};

function unwrap<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function rowToCarrierCard(row: CarrierRow): CarrierCard | null {
  const account = unwrap(row.registration_accounts);
  if (!account) return null;

  const profile = account.profile_data ?? {};
  const mc = String(profile.mcNumber ?? "").trim().toUpperCase();
  if (mc === "PLATFORM" || mc.startsWith("MC-PLATFORM")) return null;

  const plan = account.selected_plan ?? "free";
  const companyName = String(profile.companyName ?? row.name).trim() || row.name;

  return {
    id: row.id,
    name: companyName,
    plan,
    planLabel: carrierPlanLabel(plan),
    state: String(profile.state ?? "").trim(),
    serviceArea: String(profile.serviceArea ?? "").trim(),
    specialization: String(profile.specialization ?? "").trim(),
    fleetSize: String(profile.fleetSize ?? "").trim(),
    mcNumber: String(profile.mcNumber ?? "").trim(),
    rating: Number(row.rating ?? 4),
    leadsPurchased: Number(row.leads_sold ?? 0),
    mcVerified: Boolean(account.mc_verified),
    profileVerified: Boolean(account.profile_verified),
    searchCredits: searchCreditsForPlan(plan),
    about: String(profile.about ?? "").trim(),
    driverPayRange: String(profile.driverPayRange ?? "").trim(),
    homeTimePolicy: String(profile.homeTimePolicy ?? "").trim(),
    operatingRegions: String(profile.operatingRegions ?? profile.serviceArea ?? "").trim(),
    benefitsOffered: String(profile.benefitsOffered ?? "").trim(),
    contactPersonName: String(profile.contactPersonName ?? "").trim(),
    website: String(profile.website ?? "").trim()
  };
}

export async function fetchCarrierById(carrierId: string): Promise<CarrierCard | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("companies")
    .select(
      `id, name, rating, leads_sold,
      registration_accounts!inner (
        account_type, status, selected_plan, mc_verified, profile_verified, profile_data
      )`
    )
    .eq("id", carrierId)
    .eq("registration_accounts.account_type", "carrier")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return rowToCarrierCard(data as CarrierRow);
}

function toPaginated<T>(items: T[], total: number, page: number, pageSize: number): Paginated<T> {
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  };
}

export async function fetchCarrierDirectory(
  filters: CarrierDirectoryFilters = {},
  { page = 1, pageSize = DEFAULT_PAGE_SIZE }: { page?: number; pageSize?: number } = {}
): Promise<Paginated<CarrierCard>> {
  if (!supabase) return toPaginated([], 0, page, pageSize);

  const { data, error } = await supabase
    .from("companies")
    .select(
      `id, name, rating, leads_sold,
      registration_accounts!inner (
        account_type, status, selected_plan, mc_verified, profile_verified, profile_data
      )`
    )
    .eq("registration_accounts.account_type", "carrier")
    .in("registration_accounts.status", ["active", "active_preview"])
    .order("rating", { ascending: false });

  if (error) throw error;

  let cards = (data ?? [])
    .map((row) => rowToCarrierCard(row as CarrierRow))
    .filter((c): c is CarrierCard => c != null);

  if (filters.plan) {
    cards = cards.filter((c) => c.plan === filters.plan);
  }
  if (filters.state) {
    cards = cards.filter((c) => c.state === filters.state);
  }
  if (filters.verifiedOnly) {
    cards = cards.filter((c) => c.mcVerified && c.profileVerified);
  }
  if (filters.search?.trim()) {
    const q = filters.search.trim().toLowerCase();
    cards = cards.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.specialization.toLowerCase().includes(q) ||
        c.serviceArea.toLowerCase().includes(q) ||
        c.mcNumber.toLowerCase().includes(q)
    );
  }

  const total = cards.length;
  const from = (page - 1) * pageSize;
  const pageItems = cards.slice(from, from + pageSize);

  return toPaginated(pageItems, total, page, pageSize);
}

export async function fetchCarrierDirectoryStates(): Promise<string[]> {
  const { items } = await fetchCarrierDirectory({}, { page: 1, pageSize: 500 });
  return [...new Set(items.map((c) => c.state).filter(Boolean))].sort();
}
