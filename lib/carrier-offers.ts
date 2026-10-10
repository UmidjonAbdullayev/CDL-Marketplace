import type { CarrierOffersRequirements } from "../types/carrier-offers";
import { CARRIER_OFFERS_REQUIRED_KEYS } from "../types/carrier-offers";

export function emptyCarrierOffers(): CarrierOffersRequirements {
  return {
    customSections: [{ id: "custom-1", header: "", body: "" }]
  };
}

export function parseCarrierOffers(raw: unknown): CarrierOffersRequirements {
  if (!raw || typeof raw !== "object") return emptyCarrierOffers();
  const o = raw as Record<string, unknown>;
  const customSections = Array.isArray(o.customSections)
    ? o.customSections.map((s, i) => {
        const sec = s as Record<string, unknown>;
        return {
          id: String(sec.id ?? `custom-${i + 1}`),
          header: String(sec.header ?? ""),
          body: String(sec.body ?? "")
        };
      })
    : [{ id: "custom-1", header: "", body: "" }];

  return {
    ...emptyCarrierOffers(),
    ...(o as CarrierOffersRequirements),
    customSections
  };
}

function filled(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (value == null) return false;
  return String(value).trim().length > 0;
}

export function carrierOffersCompletion(offers: CarrierOffersRequirements): {
  percent: number;
  missingRequired: string[];
  isComplete: boolean;
} {
  const missingRequired: string[] = [];
  for (const key of CARRIER_OFFERS_REQUIRED_KEYS) {
    if (!filled(offers[key])) missingRequired.push(key);
  }
  const allKeys = [
    ...CARRIER_OFFERS_REQUIRED_KEYS,
    "highestPaycheck6Months",
    "escrowDetails",
    "transportationAccommodation",
    "truckYearMakeModelMileage",
    "bonuses",
    "minCdlExperience",
    "acceptedStates",
    "recruiterNotes"
  ] as const;
  let filledCount = 0;
  for (const key of allKeys) {
    if (filled(offers[key])) filledCount += 1;
  }
  const hasDriverType =
    offers.lookingForCompanyDrivers ||
    offers.lookingForOwnerOperators ||
    offers.lookingForLeaseDrivers ||
    offers.lookingForTeamDrivers;
  if (hasDriverType) filledCount += 1;
  const customFilled = (offers.customSections ?? []).some((s) => s.header.trim() && s.body.trim());
  if (customFilled) filledCount += 1;

  const total = allKeys.length + 2;
  const percent = Math.min(100, Math.round((filledCount / total) * 100));
  return {
    percent,
    missingRequired,
    isComplete: missingRequired.length === 0
  };
}

export const CARRIER_OFFERS_FIELD_LABELS: Record<string, string> = {
  minDriverExperience: "Minimum driver experience",
  minDriverAge: "Minimum driver age",
  hireTaxType: "1099 or W-2",
  driverPay: "Driver pay",
  highestPaycheck6Months: "Highest paycheck (6 months)",
  modifiesLogs: "Log modifications",
  topMileagePerWeek: "Top mileage per week",
  timeOnRoadAndHome: "Time on road / home",
  escrowDetails: "Escrow details",
  transportationAccommodation: "Transportation & accommodation",
  statesOrLanes: "States / lanes",
  trailerTypes: "Trailers",
  truckYearMakeModelMileage: "Truck year / make / model / mileage",
  truckFeatures: "Truck features",
  trucksGoverned: "Trucks governed",
  governedSpeedLimit: "Governed speed limit",
  providedItems: "Provided items",
  bonuses: "Bonuses",
  allowPassengers: "Passengers allowed",
  allowPets: "Pets allowed",
  dispatchFee: "Dispatch fee",
  ownerOpFees: "Owner operator fees",
  leaseFees: "Lease fees",
  teamFees: "Team driver fees",
  driverTypesNotes: "Driver types notes",
  minAge: "Minimum age",
  minCdlExperience: "Minimum CDL experience",
  minOtrExperience: "Minimum OTR experience",
  acceptedStates: "Accepted states",
  maxPspViolations: "Max PSP violations",
  maxPreventableAccidents: "Max preventable accidents",
  maxMovingViolations: "Max moving violations",
  drugTestHistory: "Drug test history",
  sapAccepted: "SAP accepted",
  feloniesPolicy: "Felonies policy",
  misdemeanorsPolicy: "Misdemeanors policy",
  duiPolicy: "DUI policy",
  manualTransmissionRequired: "Manual transmission required",
  twicRequired: "TWIC required",
  hazmatRequired: "Hazmat required",
  tankerRequired: "Tanker required",
  passportRequired: "Passport required",
  recruiterNotes: "Recruiter notes"
};

/** Sync legacy profile card fields from offers form */
export function syncLegacyOfferFields(offers: CarrierOffersRequirements): {
  driverPayRange: string;
  homeTimePolicy: string;
  operatingRegions: string;
  specialization: string;
  benefitsOffered: string;
} {
  const benefits: string[] = [];
  if (offers.providedItems?.trim()) benefits.push(`Provided: ${offers.providedItems.trim()}`);
  if (offers.bonuses?.trim()) benefits.push(`Bonuses: ${offers.bonuses.trim()}`);
  if (offers.transportationAccommodation?.trim()) benefits.push(offers.transportationAccommodation.trim());

  return {
    driverPayRange: offers.driverPay?.trim() ?? "",
    homeTimePolicy: offers.timeOnRoadAndHome?.trim() ?? "",
    operatingRegions: offers.statesOrLanes?.trim() ?? "",
    specialization: offers.trailerTypes?.trim() ?? "",
    benefitsOffered: benefits.join(" · ")
  };
}

export function offersSummaryLines(offers: CarrierOffersRequirements): { label: string; value: string }[] {
  const lines: { label: string; value: string }[] = [];
  const add = (key: keyof CarrierOffersRequirements, label?: string) => {
    const v = offers[key];
    if (typeof v === "string" && v.trim()) lines.push({ label: label ?? CARRIER_OFFERS_FIELD_LABELS[key] ?? key, value: v.trim() });
    if (typeof v === "boolean" && v) lines.push({ label: label ?? key, value: "Yes" });
  };
  add("minDriverExperience");
  add("minDriverAge");
  if (offers.hireTaxType) lines.push({ label: "Hire type", value: offers.hireTaxType.toUpperCase() });
  add("driverPay");
  add("timeOnRoadAndHome", "Home time");
  add("statesOrLanes", "Lanes");
  add("trailerTypes", "Equipment");
  add("escrowDetails");
  add("recruiterNotes", "Notes for recruiters");
  for (const sec of offers.customSections ?? []) {
    if (sec.header.trim() && sec.body.trim()) lines.push({ label: sec.header.trim(), value: sec.body.trim() });
  }
  return lines;
}
