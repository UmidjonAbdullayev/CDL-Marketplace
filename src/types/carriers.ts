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
};

export type CarrierDirectoryFilters = {
  plan?: CarrierPlanId | "";
  state?: string;
  verifiedOnly?: boolean;
  search?: string;
};
