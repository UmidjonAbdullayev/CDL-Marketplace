import type { CarrierCard, CarrierDirectoryFilters } from "../types/carriers";

export const CARRIER_EQUIPMENT_OPTIONS = [
  "Dry Van",
  "Reefer",
  "Flatbed",
  "Tanker",
  "Intermodal",
  "Box Truck",
  "Hopper",
  "Car Hauler"
] as const;

export const CARRIER_HOME_TIME_OPTIONS = [
  { value: "", label: "Any home time" },
  { value: "daily", label: "Daily / Every night" },
  { value: "weekly", label: "Weekly" },
  { value: "2-weeks", label: "2 weeks out" },
  { value: "3-weeks", label: "3+ weeks out" },
  { value: "monthly", label: "Monthly+" }
] as const;

export const CARRIER_FLEET_SIZE_OPTIONS = [
  { value: "", label: "Any fleet size" },
  { value: "1-10", label: "1–10 trucks" },
  { value: "11-50", label: "11–50 trucks" },
  { value: "51-100", label: "51–100 trucks" },
  { value: "101+", label: "101+ trucks" }
] as const;

export const CARRIER_MIN_RATING_OPTIONS = [
  { value: 0, label: "Any rating" },
  { value: 3.5, label: "3.5+ stars" },
  { value: 4, label: "4.0+ stars" },
  { value: 4.5, label: "4.5+ stars" }
] as const;

export const initialCarrierFilters: CarrierDirectoryFilters = {
  search: "",
  state: "",
  region: "",
  equipment: "",
  homeTime: "",
  fleetSize: "",
  minRating: 0,
  plan: "",
  verifiedOnly: false,
  hasPayRange: false
};

export function carrierInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function formatMcNumber(mc: string): string {
  const raw = mc.trim();
  if (!raw) return "MC —";
  if (raw.toUpperCase().startsWith("MC")) return raw.toUpperCase();
  return `MC ${raw}`;
}

export function parseFleetCount(fleetSize: string): number | null {
  const match = fleetSize.replace(/,/g, "").match(/(\d+)/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

export function fleetMatchesBucket(fleetSize: string, bucket: string): boolean {
  if (!bucket) return true;
  const n = parseFleetCount(fleetSize);
  if (n == null) return bucket === "1-10";
  if (bucket === "1-10") return n <= 10;
  if (bucket === "11-50") return n >= 11 && n <= 50;
  if (bucket === "51-100") return n >= 51 && n <= 100;
  if (bucket === "101+") return n >= 101;
  return true;
}

function homeTimeMatches(policy: string, filter: string): boolean {
  if (!filter) return true;
  const p = policy.toLowerCase();
  if (filter === "daily") return /daily|every night|home (every|each) night|nightly/.test(p);
  if (filter === "weekly") return /weekly|every week|1 week|week out/.test(p);
  if (filter === "2-weeks") return /2 week|two week|bi-?weekly/.test(p);
  if (filter === "3-weeks") return /3 week|three week|3\+ week/.test(p);
  if (filter === "monthly") return /month|28 day|30 day/.test(p);
  return p.includes(filter.replace("-", " "));
}

function equipmentMatches(specialization: string, filterEquipment: string): boolean {
  if (!filterEquipment) return true;
  return specialization.toLowerCase().includes(filterEquipment.toLowerCase());
}

export function activeCarrierFilterCount(filters: CarrierDirectoryFilters): number {
  let n = 0;
  if (filters.search?.trim()) n++;
  if (filters.state) n++;
  if (filters.region) n++;
  if (filters.equipment) n++;
  if (filters.homeTime) n++;
  if (filters.fleetSize) n++;
  if (filters.minRating && filters.minRating > 0) n++;
  if (filters.plan) n++;
  if (filters.verifiedOnly) n++;
  if (filters.hasPayRange) n++;
  return n;
}

export function filterCarrierCards(cards: CarrierCard[], filters: CarrierDirectoryFilters): CarrierCard[] {
  let result = cards;

  if (filters.plan) {
    result = result.filter((c) => c.plan === filters.plan);
  }
  if (filters.state) {
    result = result.filter((c) => c.state === filters.state);
  }
  if (filters.region) {
    const q = filters.region.toLowerCase();
    result = result.filter(
      (c) =>
        c.operatingRegions.toLowerCase().includes(q) ||
        c.serviceArea.toLowerCase().includes(q) ||
        c.state.toLowerCase() === q
    );
  }
  if (filters.equipment) {
    result = result.filter((c) => equipmentMatches(c.specialization, filters.equipment!));
  }
  if (filters.homeTime) {
    result = result.filter((c) => homeTimeMatches(c.homeTimePolicy, filters.homeTime!));
  }
  if (filters.fleetSize) {
    result = result.filter((c) => fleetMatchesBucket(c.fleetSize, filters.fleetSize!));
  }
  if (filters.minRating && filters.minRating > 0) {
    result = result.filter((c) => c.rating >= filters.minRating!);
  }
  if (filters.verifiedOnly) {
    result = result.filter((c) => c.mcVerified && c.profileVerified);
  }
  if (filters.hasPayRange) {
    result = result.filter((c) => Boolean(c.driverPayRange?.trim()));
  }
  if (filters.search?.trim()) {
    const q = filters.search.trim().toLowerCase();
    result = result.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.specialization.toLowerCase().includes(q) ||
        c.serviceArea.toLowerCase().includes(q) ||
        c.operatingRegions.toLowerCase().includes(q) ||
        c.mcNumber.toLowerCase().includes(q) ||
        c.homeTimePolicy.toLowerCase().includes(q) ||
        c.driverPayRange.toLowerCase().includes(q)
    );
  }

  return result;
}

export function carrierEquipmentLabel(card: CarrierCard): string {
  if (card.specialization?.trim()) return card.specialization;
  return "General freight";
}

export function carrierIsActive(card: CarrierCard): boolean {
  return card.mcVerified && card.profileVerified;
}
