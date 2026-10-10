import type { DriverApplicationFormData, EmploymentRecord, DriverReference } from "../types/driver-application-form";

export type DriverApplicationSection = {
  id: string;
  title: string;
  description: string;
  fields: (keyof DriverApplicationFormData | "employmentHistory" | "references")[];
};

export const DRIVER_APPLICATION_SECTIONS: DriverApplicationSection[] = [
  {
    id: "personal",
    title: "Personal information",
    description: "Legal name, date of birth, and home address",
    fields: ["middleName", "dateOfBirth", "ssnLast4", "streetAddress", "city", "state", "zip"]
  },
  {
    id: "contact",
    title: "Contact information",
    description: "Phone numbers and emergency contact",
    fields: ["altPhone", "emergencyContact", "emergencyPhone"]
  },
  {
    id: "cdl",
    title: "CDL & credentials",
    description: "License details, endorsements, and medical card",
    fields: ["cdlNumber", "cdlClass", "cdlState", "cdlExpiration", "endorsements", "medCardExpiration", "hasTwic", "hasHazmat", "hasTanker"]
  },
  {
    id: "experience",
    title: "Driving experience",
    description: "Years of experience, equipment, and lanes",
    fields: ["totalYearsExp", "otrYearsExp", "equipmentTypes", "preferredFreight", "statesRun"]
  },
  {
    id: "employment",
    title: "Employment history",
    description: "Previous employers (TenStreet-style)",
    fields: ["employmentHistory"]
  },
  {
    id: "safety",
    title: "Accidents & violations",
    description: "Safety record and drug/alcohol history",
    fields: ["accidentsPast3Years", "accidentDetails", "violationsPast3Years", "violationDetails", "licenseSuspensions", "failedDrugTest", "sapProgram"]
  },
  {
    id: "criminal",
    title: "Criminal history",
    description: "Felonies, misdemeanors, and DUI disclosures",
    fields: ["felonies", "felonyDetails", "misdemeanors", "misdemeanorDetails", "dui", "duiDetails"]
  },
  {
    id: "preferences",
    title: "Preferences & availability",
    description: "Driver type, pay expectations, and start date",
    fields: ["driverType", "desiredPay", "homeTimePref", "availableDate", "teamDriver", "ownerOperator"]
  },
  {
    id: "references",
    title: "References",
    description: "Professional references",
    fields: ["references"]
  },
  {
    id: "documents",
    title: "Documents",
    description: "CDL copy, medical card, MVR, and other uploads",
    fields: []
  }
];

export const DRIVER_DOCUMENT_LABELS = [
  "CDL (front & back)",
  "Medical card",
  "MVR / driving record",
  "Social Security card (optional)",
  "Proof of address",
  "Other"
] as const;

function filled(value: unknown): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) return value.some((item) => typeof item === "object" && item && Object.values(item).some((v) => String(v ?? "").trim()));
  return String(value).trim().length > 0;
}

export function emptyEmploymentHistory(): EmploymentRecord[] {
  return [
    { employer: "", from: "", to: "", equipment: "", reasonLeaving: "", contactPhone: "" },
    { employer: "", from: "", to: "", equipment: "", reasonLeaving: "", contactPhone: "" },
    { employer: "", from: "", to: "", equipment: "", reasonLeaving: "", contactPhone: "" }
  ];
}

export function emptyReferences(): DriverReference[] {
  return [
    { name: "", phone: "", relation: "" },
    { name: "", phone: "", relation: "" }
  ];
}

export function parseDriverApplicationForm(raw: unknown): DriverApplicationFormData {
  const base: DriverApplicationFormData = {
    employmentHistory: emptyEmploymentHistory(),
    references: emptyReferences()
  };
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const employmentHistory = Array.isArray(o.employmentHistory)
    ? o.employmentHistory.map((e) => {
        const r = e as Record<string, string>;
        return {
          employer: r.employer ?? "",
          from: r.from ?? "",
          to: r.to ?? "",
          equipment: r.equipment ?? "",
          reasonLeaving: r.reasonLeaving ?? "",
          contactPhone: r.contactPhone ?? ""
        };
      })
    : emptyEmploymentHistory();
  const references = Array.isArray(o.references)
    ? o.references.map((e) => {
        const r = e as Record<string, string>;
        return { name: r.name ?? "", phone: r.phone ?? "", relation: r.relation ?? "" };
      })
    : emptyReferences();
  return { ...base, ...(o as DriverApplicationFormData), employmentHistory, references };
}

export function driverApplicationSectionComplete(
  sectionId: string,
  form: DriverApplicationFormData,
  documentCount: number
): boolean {
  if (sectionId === "documents") return documentCount > 0;
  const section = DRIVER_APPLICATION_SECTIONS.find((s) => s.id === sectionId);
  if (!section) return false;
  if (sectionId === "employment") {
    return (form.employmentHistory ?? []).some((e) => e.employer.trim() && e.from.trim());
  }
  if (sectionId === "references") {
    return (form.references ?? []).some((r) => r.name.trim() && r.phone.trim());
  }
  return section.fields.some((key) => {
    if (key === "employmentHistory" || key === "references") return false;
    return filled(form[key as keyof DriverApplicationFormData]);
  });
}

export function driverApplicationCompletion(
  form: DriverApplicationFormData,
  documentCount: number,
  hasIdentity: boolean
): { percent: number; completedSections: number; totalSections: number } {
  const identityWeight = hasIdentity ? 1 : 0;
  let completed = identityWeight;
  const total = DRIVER_APPLICATION_SECTIONS.length + 1;
  for (const section of DRIVER_APPLICATION_SECTIONS) {
    if (driverApplicationSectionComplete(section.id, form, documentCount)) completed += 1;
  }
  const percent = Math.min(100, Math.round((completed / total) * 100));
  return { percent, completedSections: completed, totalSections: total };
}

export function driverApplicationStatusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: "Draft",
    in_progress: "In progress",
    submitted: "Submitted",
    reviewed: "Reviewed",
    archived: "Archived"
  };
  return map[status] ?? status;
}

export function driverApplicationStatusBadge(status: string): string {
  const map: Record<string, string> = {
    draft: "badge-gray",
    in_progress: "badge-yellow",
    submitted: "badge-green",
    reviewed: "badge-blue",
    archived: "badge-gray"
  };
  return map[status] ?? "badge-gray";
}
