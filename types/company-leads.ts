export type CompanyLeadStage =
  | "lead"
  | "contacted"
  | "application"
  | "mvr"
  | "background"
  | "drug_ordered"
  | "drug_passed"
  | "drug_failed"
  | "interview"
  | "orientation"
  | "flight_booked"
  | "pre_hire"
  | "hired"
  | "inactive"
  | "disqualified";

export type CompanyLeadSource = "admin" | "manual" | "imported";

export type CompanyLead = {
  id: string;
  company_id: string;
  batch_id: string | null;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  cdl_class: string;
  state: string | null;
  years_experience: number | null;
  endorsements: string | null;
  driver_type: string | null;
  source: CompanyLeadSource | string;
  stage: CompanyLeadStage | string;
  notes_preview: string | null;
  assigned_by_account_id: string | null;
  assigned_at: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type CompanyLeadNote = {
  id: string;
  lead_id: string;
  company_id: string;
  author_name: string;
  body: string;
  created_at: string;
};

export type CompanyLeadInput = {
  first_name: string;
  last_name: string;
  phone?: string;
  email?: string;
  cdl_class?: string;
  state?: string;
  years_experience?: number | null;
  endorsements?: string;
  driver_type?: string;
  stage?: CompanyLeadStage;
  notes_preview?: string;
};

export type CompanyLeadFilters = {
  search?: string;
  stage?: string;
  driverType?: string;
  state?: string;
  source?: string;
  dateFrom?: string;
  dateTo?: string;
  bucket?: "all" | "active" | "pipeline" | "hired" | "alerts";
};

export type CompanyLeadBatch = {
  id: string;
  company_id: string;
  created_by_account_id: string | null;
  file_name: string | null;
  source: string;
  lead_count: number;
  created_at: string;
};
