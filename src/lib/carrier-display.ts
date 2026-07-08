import { carrierInitials, carrierEquipmentLabel, formatMcNumber } from "./carrier-filters";
import type { CarrierCard } from "../types/carriers";

export type CarrierCardDisplay = {
  carrier: CarrierCard;
  mcNumber: string;
  rating: string;
  reviewCount: number;
  fleetSize: string;
  homeTime: string;
  payRange: string;
  location: string;
  equipment: string;
  avatarBg: string;
  avatarFg: string;
  initials: string;
};

const AVATAR_BG = ["#0F172A", "#1E3A5F", "#2563EB", "#7C3AED", "#DC2626"];
const AVATAR_FG = "#FFFFFF";

function avatarIndex(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash + id.charCodeAt(i)) % AVATAR_BG.length;
  return hash;
}

function fleetDisplay(fleetSize: string): string {
  const trimmed = fleetSize.trim();
  if (!trimmed) return "—";
  if (/\+|fleet|truck/i.test(trimmed)) return trimmed;
  return `${trimmed}+`;
}

export function toCarrierCardDisplay(carrier: CarrierCard): CarrierCardDisplay {
  const idx = avatarIndex(carrier.id);
  return {
    carrier,
    mcNumber: formatMcNumber(carrier.mcNumber),
    rating: carrier.rating.toFixed(1),
    reviewCount: carrier.leadsPurchased,
    fleetSize: fleetDisplay(carrier.fleetSize),
    homeTime: carrier.homeTimePolicy || "Not specified",
    payRange: carrier.driverPayRange || "Contact for rates",
    location: carrier.operatingRegions || carrier.serviceArea || carrier.state || "—",
    equipment: carrierEquipmentLabel(carrier),
    avatarBg: AVATAR_BG[idx],
    avatarFg: AVATAR_FG,
    initials: carrierInitials(carrier.name)
  };
}
