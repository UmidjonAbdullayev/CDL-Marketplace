export type YesNo = "yes" | "no" | "";
export type HireTaxType = "1099" | "w2" | "both" | "";
export type FelonyPolicy = "accepted" | "case_by_case" | "no" | "";
export type CustomTextSection = { id: string; header: string; body: string };

export type CarrierOffersRequirements = {
  updatedAt?: string;
  /** Core offer details */
  minDriverExperience?: string;
  minDriverAge?: string;
  hireTaxType?: HireTaxType;
  driverPay?: string;
  highestPaycheck6Months?: string;
  modifiesLogs?: YesNo;
  topMileagePerWeek?: string;
  timeOnRoadAndHome?: string;
  escrowDetails?: string;
  transportationAccommodation?: string;
  statesOrLanes?: string;
  trailerTypes?: string;
  truckYearMakeModelMileage?: string;
  truckFeatures?: string;
  trucksGoverned?: YesNo;
  governedSpeedLimit?: string;
  providedItems?: string;
  bonuses?: string;
  allowPassengers?: YesNo;
  allowPets?: YesNo;
  /** Owner op / lease / team fees */
  dispatchFee?: string;
  ownerOpFees?: string;
  leaseFees?: string;
  teamFees?: string;
  /** Driver types sought */
  lookingForCompanyDrivers?: boolean;
  lookingForOwnerOperators?: boolean;
  lookingForLeaseDrivers?: boolean;
  lookingForTeamDrivers?: boolean;
  driverTypesNotes?: string;
  /** Hiring requirements */
  minAge?: string;
  minCdlExperience?: string;
  minOtrExperience?: string;
  acceptedStates?: string;
  maxPspViolations?: string;
  maxPreventableAccidents?: string;
  maxMovingViolations?: string;
  drugTestHistory?: string;
  sapAccepted?: YesNo;
  feloniesPolicy?: FelonyPolicy;
  misdemeanorsPolicy?: string;
  duiPolicy?: string;
  manualTransmissionRequired?: YesNo;
  twicRequired?: YesNo;
  hazmatRequired?: YesNo;
  tankerRequired?: YesNo;
  passportRequired?: YesNo;
  recruiterNotes?: string;
  /** Additional free-text sections shown on carrier profile/card */
  customSections?: CustomTextSection[];
};

export const CARRIER_OFFERS_REQUIRED_KEYS: (keyof CarrierOffersRequirements)[] = [
  "minDriverExperience",
  "minDriverAge",
  "hireTaxType",
  "driverPay",
  "timeOnRoadAndHome",
  "statesOrLanes",
  "trailerTypes"
];
