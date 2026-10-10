import type { CompanyLeadStage } from "../types/company-leads";

export type LeadStageDef = {
  key: CompanyLeadStage;
  label: string;
  badge: string;
};

export const COMPANY_LEAD_STAGES: LeadStageDef[] = [
  { key: "lead", label: "Lead", badge: "badge-gray" },
  { key: "contacted", label: "Contacted", badge: "badge-yellow" },
  { key: "application", label: "Application", badge: "badge-blue" },
  { key: "mvr", label: "MVR", badge: "badge-blue" },
  { key: "background", label: "Background", badge: "badge-purple" },
  { key: "drug_ordered", label: "Drug Ordered", badge: "badge-purple" },
  { key: "drug_passed", label: "Drug Passed", badge: "badge-green" },
  { key: "drug_failed", label: "Drug Failed", badge: "badge-red" },
  { key: "interview", label: "Interview", badge: "badge-blue" },
  { key: "orientation", label: "Orientation", badge: "badge-yellow" },
  { key: "flight_booked", label: "Flight Booked", badge: "badge-purple" },
  { key: "pre_hire", label: "Pre-hire", badge: "badge-blue" },
  { key: "hired", label: "Hired", badge: "badge-green" },
  { key: "inactive", label: "Inactive", badge: "badge-gray" },
  { key: "disqualified", label: "Disqualified", badge: "badge-red" }
];

export const LEAD_PIPELINE_BUCKETS: { key: "all" | "active" | "pipeline" | "hired" | "alerts"; label: string; stages?: CompanyLeadStage[] }[] = [
  { key: "all", label: "All" },
  {
    key: "active",
    label: "Active",
    stages: ["lead", "contacted", "application", "mvr", "background", "drug_ordered", "interview", "orientation", "flight_booked", "pre_hire"]
  },
  {
    key: "pipeline",
    label: "Pipeline",
    stages: ["application", "mvr", "background", "drug_ordered", "drug_passed", "interview", "orientation", "flight_booked", "pre_hire"]
  },
  { key: "hired", label: "Hired", stages: ["hired"] },
  { key: "alerts", label: "Alerts", stages: ["drug_failed", "disqualified", "inactive"] }
];

export const LEAD_DRIVER_TYPES = [
  "Company Driver",
  "Owner Operator",
  "Lease",
  "Team",
  "Any"
] as const;

export function leadStageLabel(stage: string): string {
  return COMPANY_LEAD_STAGES.find((s) => s.key === stage)?.label ?? stage.replace(/_/g, " ");
}

export function leadStageBadge(stage: string): string {
  return COMPANY_LEAD_STAGES.find((s) => s.key === stage)?.badge ?? "badge-gray";
}

export function leadFullName(lead: { first_name: string; last_name: string }): string {
  return `${lead.first_name} ${lead.last_name}`.trim() || "Unnamed driver";
}

export function leadMaskName(lead: { first_name: string; last_name: string }): string {
  const last = lead.last_name?.trim();
  if (!last) return lead.first_name || "Driver";
  return `${lead.first_name} ${last.charAt(0)}.`;
}

export function stagesForBucket(bucket?: string): CompanyLeadStage[] | null {
  if (!bucket || bucket === "all") return null;
  const found = LEAD_PIPELINE_BUCKETS.find((b) => b.key === bucket);
  return found?.stages ?? null;
}
