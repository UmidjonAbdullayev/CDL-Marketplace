export type AccountType = "carrier" | "agency" | "solo_recruiter";

export type AdminRole = "none" | "admin" | "manager";

export type CarrierPlanId = "free" | "starter" | "growth" | "pro_fleet";

export type RegistrationStatus =
  | "active_preview"
  | "pending_payment"
  | "pending_review"
  | "active"
  | "rejected"
  | "suspended";

export type CarrierProfile = {
  companyName: string;
  mcNumber: string;
  dotNumber?: string;
  companyEmail: string;
  phone: string;
  website: string;
  contactPersonName: string;
  contactPersonRole: string;
  specialization: string;
  serviceArea: string;
  fleetSize: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  about?: string;
  /** Weekly pay range offered to drivers, e.g. "$1,800–$2,400/week" */
  driverPayRange?: string;
  /** Home time policy, e.g. "Home every 2 weeks" */
  homeTimePolicy?: string;
  /** Primary lanes / operating regions */
  operatingRegions?: string;
  /** Additional benefits or perks */
  benefitsOffered?: string;
};

export type AgencyProfile = {
  agencyName: string;
  companyEmail: string;
  phone: string;
  website: string;
  contactPersonName: string;
  contactPersonRole: string;
  specialization: string;
  serviceArea: string;
  yearsInBusiness: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  about?: string;
  avgMonthlyLeads?: string;
  primaryDriverTypes?: string;
};

export type SoloRecruiterProfile = {
  fullName: string;
  email: string;
  phone: string;
  yearsExperience: string;
  primaryDriverTypes: string;
  serviceArea: string;
  currentRole: string;
};

export type RegistrationAccount = {
  id: string;
  auth_user_id?: string | null;
  account_type: AccountType;
  status: RegistrationStatus;
  selected_plan: CarrierPlanId | null;
  email: string;
  profile_data: CarrierProfile | AgencyProfile | SoloRecruiterProfile;
  policy_accepted: boolean;
  policy_accepted_at: string | null;
  policy_version: string | null;
  accepted_ip_address: string | null;
  accepted_user_agent: string | null;
  rejection_reason: string | null;
  mc_verified: boolean;
  profile_verified: boolean;
  suspended: boolean;
  company_id: string | null;
  is_admin: boolean;
  admin_role: AdminRole;
  created_at: string;
  updated_at: string;
};

export type RegistrationPayload = {
  accountType: AccountType;
  selectedPlan?: CarrierPlanId;
  email: string;
  password: string;
  profile: CarrierProfile | AgencyProfile | SoloRecruiterProfile;
  policyAccepted: boolean;
  policyVersion: string;
};
