import type { CarrierOffersRequirements } from "./carrier-offers";
import type { CarrierPlanId } from "./registration";

export type CarrierCard = {
  id: string;
  name: string;
  plan: CarrierPlanId;
  planLabel: string;
  state: string;
  serviceArea: string;
  specialization: string;
  fleetSize: string;
  mcNumber: string;
  rating: number;
  leadsPurchased: number;
  mcVerified: boolean;
  profileVerified: boolean;
  searchCredits: number;
  about: string;
  driverPayRange: string;
  homeTimePolicy: string;
  operatingRegions: string;
  benefitsOffered: string;
  contactPersonName: string;
  website: string;
  offersRequirements: CarrierOffersRequirements | null;
  offersComplete: boolean;
};

export type CarrierDirectoryFilters = {
  plan?: CarrierPlanId | "";
  state?: string;
  region?: string;
  equipment?: string;
  homeTime?: string;
  fleetSize?: string;
  minRating?: number;
  verifiedOnly?: boolean;
  hasPayRange?: boolean;
  search?: string;
};
