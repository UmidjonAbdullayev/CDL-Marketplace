import type { DriverType } from "./driver-types";

export type DriverPreferences = {
  desiredWeeklyPay: string;
  weeksOutPreference: string;
  maxDispatchFeePct: number | null;
  companyExpectations: string;
};

export const WEEKS_OUT_OPTIONS = [
  "1 week out / 2–3 days home",
  "2 weeks out / 4 days home",
  "3 weeks out / 1 week home",
  "4 weeks out / 1 week home",
  "Home weekly",
  "Home every other weekend",
  "Flexible / open to discuss"
] as const;

export function isOwnerStyleDriverType(driverType: string): boolean {
  return driverType === "Owner Operator" || driverType === "Lease";
}

export function driverPreferencesSummary(prefs: Partial<DriverPreferences>): string[] {
  const lines: string[] = [];
  if (prefs.desiredWeeklyPay?.trim()) lines.push(prefs.desiredWeeklyPay.trim());
  if (prefs.weeksOutPreference?.trim()) lines.push(prefs.weeksOutPreference.trim());
  if (prefs.maxDispatchFeePct != null && prefs.maxDispatchFeePct > 0) {
    lines.push(`≤ ${prefs.maxDispatchFeePct}% dispatch`);
  }
  return lines;
}

export function validateDriverPreferences(
  prefs: DriverPreferences,
  driverType: DriverType | string
): string[] {
  const errs: string[] = [];
  if (!prefs.desiredWeeklyPay.trim()) errs.push("Target weekly pay is required");
  if (!prefs.weeksOutPreference.trim()) errs.push("Weeks out / home time preference is required");
  if (isOwnerStyleDriverType(driverType)) {
    if (prefs.maxDispatchFeePct == null || prefs.maxDispatchFeePct <= 0) {
      errs.push("Max dispatch fee % is required for owner operators and lease drivers");
    } else if (prefs.maxDispatchFeePct > 100) {
      errs.push("Dispatch fee cannot exceed 100%");
    }
  }
  return errs;
}
