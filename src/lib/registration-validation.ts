import type { AccountType, AgencyProfile, CarrierProfile, SoloRecruiterProfile } from "../types/registration";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[\d\s().+-]{10,}$/;
const MC_RE = /^MC-?\d{5,7}$/i;
const ZIP_RE = /^\d{5}(-\d{4})?$/;

export type FieldErrors = Record<string, string>;

export function validateEmail(email: string): string | null {
  if (!email.trim()) return "Email is required";
  if (!EMAIL_RE.test(email.trim())) return "Enter a valid email address";
  return null;
}

export function validatePhone(phone: string): string | null {
  if (!phone.trim()) return "Phone number is required";
  if (!PHONE_RE.test(phone.trim())) return "Enter a valid phone number";
  return null;
}

export function validatePassword(password: string, confirm: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!password) errors.password = "Password is required";
  else if (password.length < 8) errors.password = "Password must be at least 8 characters";
  if (password !== confirm) errors.confirmPassword = "Passwords do not match";
  return errors;
}

export function validateMcNumber(mc: string): string | null {
  if (!mc.trim()) return "MC Number is required";
  if (!MC_RE.test(mc.trim())) return "Use format MC-XXXXXX (e.g. MC-892471)";
  return null;
}

function required(value: string, label: string): string | null {
  return value.trim() ? null : `${label} is required`;
}

export function validateCarrierProfile(p: CarrierProfile, password: string, confirm: string): FieldErrors {
  const errors: FieldErrors = {};
  const checks: [keyof CarrierProfile, string][] = [
    ["companyName", "Company name"],
    ["mcNumber", "MC Number"],
    ["companyEmail", "Company email"],
    ["phone", "Phone number"],
    ["website", "Website"],
    ["contactPersonName", "Contact person name"],
    ["contactPersonRole", "Contact person role"],
    ["specialization", "Specialization"],
    ["serviceArea", "Service area"],
    ["fleetSize", "Fleet size"],
    ["address", "Business address"],
    ["city", "City"],
    ["state", "State"],
    ["zip", "ZIP"]
  ];
  for (const [key, label] of checks) {
    const err = required(String(p[key] ?? ""), label);
    if (err) errors[key] = err;
  }
  const mcErr = validateMcNumber(p.mcNumber);
  if (mcErr) errors.mcNumber = mcErr;
  const emailErr = validateEmail(p.companyEmail);
  if (emailErr) errors.companyEmail = emailErr;
  const phoneErr = validatePhone(p.phone);
  if (phoneErr) errors.phone = phoneErr;
  if (!ZIP_RE.test(p.zip.trim())) errors.zip = "Enter a valid ZIP code";
  Object.assign(errors, validatePassword(password, confirm));
  return errors;
}

export function validateAgencyProfile(p: AgencyProfile, password: string, confirm: string): FieldErrors {
  const errors: FieldErrors = {};
  const checks: [keyof AgencyProfile, string][] = [
    ["agencyName", "Agency name"],
    ["companyEmail", "Company email"],
    ["phone", "Phone number"],
    ["website", "Website"],
    ["contactPersonName", "Contact person name"],
    ["contactPersonRole", "Contact person role"],
    ["specialization", "Specialization"],
    ["serviceArea", "Service area"],
    ["yearsInBusiness", "Years in business"],
    ["address", "Business address"],
    ["city", "City"],
    ["state", "State"],
    ["zip", "ZIP"]
  ];
  for (const [key, label] of checks) {
    const err = required(String(p[key] ?? ""), label);
    if (err) errors[key] = err;
  }
  const emailErr = validateEmail(p.companyEmail);
  if (emailErr) errors.companyEmail = emailErr;
  const phoneErr = validatePhone(p.phone);
  if (phoneErr) errors.phone = phoneErr;
  if (!ZIP_RE.test(p.zip.trim())) errors.zip = "Enter a valid ZIP code";
  Object.assign(errors, validatePassword(password, confirm));
  return errors;
}

export function validateSoloProfile(p: SoloRecruiterProfile, password: string, confirm: string): FieldErrors {
  const errors: FieldErrors = {};
  const checks: [keyof SoloRecruiterProfile, string][] = [
    ["fullName", "Full name"],
    ["email", "Email"],
    ["phone", "Phone number"],
    ["yearsExperience", "Years of experience"],
    ["primaryDriverTypes", "Primary driver types"],
    ["serviceArea", "Service area"],
    ["currentRole", "Current role"]
  ];
  for (const [key, label] of checks) {
    const err = required(String(p[key] ?? ""), label);
    if (err) errors[key] = err;
  }
  const emailErr = validateEmail(p.email);
  if (emailErr) errors.email = emailErr;
  const phoneErr = validatePhone(p.phone);
  if (phoneErr) errors.phone = phoneErr;
  Object.assign(errors, validatePassword(password, confirm));
  return errors;
}

export function validateProfileStep(
  type: AccountType,
  profile: CarrierProfile | AgencyProfile | SoloRecruiterProfile,
  password: string,
  confirm: string
): FieldErrors {
  if (type === "carrier") return validateCarrierProfile(profile as CarrierProfile, password, confirm);
  if (type === "agency") return validateAgencyProfile(profile as AgencyProfile, password, confirm);
  return validateSoloProfile(profile as SoloRecruiterProfile, password, confirm);
}
