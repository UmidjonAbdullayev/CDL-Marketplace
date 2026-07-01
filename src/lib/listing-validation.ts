import { validateRecruiterListPrice } from "./listing-pricing";

export const LISTING_STEPS = [
  "Basic Info",
  "Qualifications",
  "Availability & Preferences",
  "Documents",
  "Consent",
  "Pricing",
  "Review"
] as const;

import { validateDriverPreferences } from "./driver-preferences";

export type ListingFieldSnapshot = {
  first: string;
  last: string;
  state: string;
  phone: string;
  cdlClass: string;
  yearsExp: number | "";
  monthsExp: number | "";
  availDate: string;
  equipment: string;
  routePref: string;
  driverType: string;
  desiredWeeklyPay: string;
  weeksOutPreference: string;
  maxDispatchFeePct: number | "";
  companyExpectations: string;
  documents: string[];
  consent: boolean;
  price: number | "";
};

export type ListingStepIssue = {
  step: number;
  stepName: string;
  errors: string[];
};

const COLUMN_LABELS: Record<string, string> = {
  first_name: "First name",
  last_name: "Last name",
  state: "State",
  phone: "Phone",
  email: "Email",
  cdl_class: "CDL class",
  cdl_number: "CDL number",
  years_exp: "Years of experience",
  months_exp: "Months of experience",
  available_date: "Available date",
  equipment: "Equipment preference",
  route_pref: "Route preference",
  driver_type: "Driver type",
  price: "Listing price",
  documents: "Documents",
  notes: "Notes",
  seller_company_id: "Seller account"
};

export function listingStepErrors(stepNum: number, fields: ListingFieldSnapshot): string[] {
  const errs: string[] = [];
  if (stepNum === 1) {
    if (!fields.first.trim()) errs.push("First name is required");
    if (!fields.last.trim()) errs.push("Last name is required");
    if (!fields.state) errs.push("State is required");
    if (!fields.phone.trim()) errs.push("Phone number is required");
  }
  if (stepNum === 2) {
    if (!fields.cdlClass) errs.push("CDL class is required");
    if (fields.yearsExp === "") errs.push("Years of experience is required");
    if (fields.monthsExp === "") errs.push("Months of experience is required");
  }
  if (stepNum === 3) {
    if (!fields.availDate) errs.push("Availability date is required");
    if (!fields.equipment) errs.push("Equipment preference is required");
    if (!fields.routePref) errs.push("Route preference is required");
    if (!fields.driverType) errs.push("Driver type is required");
    errs.push(
      ...validateDriverPreferences(
        {
          desiredWeeklyPay: fields.desiredWeeklyPay,
          weeksOutPreference: fields.weeksOutPreference,
          maxDispatchFeePct: fields.maxDispatchFeePct === "" ? null : fields.maxDispatchFeePct,
          companyExpectations: fields.companyExpectations
        },
        fields.driverType
      )
    );
  }
  if (stepNum === 4) {
    if (!fields.documents.length) errs.push("Upload at least one document");
  }
  if (stepNum === 5) {
    if (!fields.consent) errs.push("Driver consent confirmation is required");
  }
  if (stepNum === 6) {
    if (fields.price === "") {
      errs.push("Listing price is required");
    } else {
      const priceError = validateRecruiterListPrice(Number(fields.price), fields.driverType);
      if (priceError) errs.push(priceError);
    }
  }
  return errs;
}

export function listingStepComplete(stepNum: number, fields: ListingFieldSnapshot): boolean {
  return listingStepErrors(stepNum, fields).length === 0;
}

export function collectListingIssues(fields: ListingFieldSnapshot, throughStep = 6): ListingStepIssue[] {
  const issues: ListingStepIssue[] = [];
  for (let step = 1; step <= throughStep; step += 1) {
    const errors = listingStepErrors(step, fields);
    if (errors.length) {
      issues.push({ step, stepName: LISTING_STEPS[step - 1], errors });
    }
  }
  return issues;
}

export function formatListingIssuesForToast(issues: ListingStepIssue[]): string {
  const first = issues[0];
  if (!first) return "Fix the highlighted fields before publishing.";
  if (first.errors.length === 1) {
    return `Step ${first.step} (${first.stepName}): ${first.errors[0]}`;
  }
  return `Step ${first.step} (${first.stepName}): ${first.errors.length} issues — ${first.errors[0]}`;
}

function columnFromDbMessage(message: string): string | null {
  const quoted = message.match(/column "([^"]+)"/i);
  if (quoted?.[1]) return quoted[1];
  const named = message.match(/'([^']+)' column/i);
  return named?.[1] ?? null;
}

export function formatListingPublishError(error: unknown): string[] {
  if (!error) return ["Unknown error while publishing the listing."];

  if (error instanceof Error) {
    const msg = error.message.trim();
    if (!msg) return ["Unknown error while publishing the listing."];

    if (/listing limit|active listing/i.test(msg)) return [msg];
    if (/minimum listing price|maximum listing price/i.test(msg)) return [msg];
    if (/supabase not configured/i.test(msg)) return [msg];

    const column = columnFromDbMessage(msg);
    if (column) {
      const label = COLUMN_LABELS[column] ?? column.replace(/_/g, " ");
      if (/not-null|null value/i.test(msg)) {
        return [`${label} is required by the database. Check this field on the form and try again.`];
      }
      if (/check constraint|invalid input/i.test(msg)) {
        return [`${label} has an invalid value. Review the field and try again.`];
      }
      return [`${label}: ${msg}`];
    }

    if (/permission|row-level security|RLS/i.test(msg)) {
      return ["You do not have permission to publish this listing. Sign in again or contact support."];
    }

    if (/foreign key|seller_company/i.test(msg)) {
      return ["Your company account could not be linked to this listing. Refresh the page and try again."];
    }

    return [msg];
  }

  return ["Failed to publish listing. Please review your entries and try again."];
}
