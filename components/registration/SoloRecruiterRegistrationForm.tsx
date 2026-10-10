import type { ReactNode } from "react";
import type { SoloRecruiterProfile } from "../../types/registration";
import type { FieldErrors } from "../../lib/registration-validation";

type Props = {
  value: SoloRecruiterProfile;
  errors: FieldErrors;
  password: string;
  confirmPassword: string;
  onChange: (patch: Partial<SoloRecruiterProfile>) => void;
  onPasswordChange: (password: string) => void;
  onConfirmChange: (confirm: string) => void;
};

function Field({ label, name, error, children }: { label: string; name: string; error?: string; children: ReactNode }) {
  return (
    <div className={`form-group ${error ? "has-error" : ""}`}>
      <label htmlFor={name}>{label}</label>
      {children}
      {error ? <span className="field-error">{error}</span> : null}
    </div>
  );
}

export function SoloRecruiterRegistrationForm({
  value,
  errors,
  password,
  confirmPassword,
  onChange,
  onPasswordChange,
  onConfirmChange
}: Props) {
  return (
    <div className="reg-form-grid">
      <Field label="Full Name *" name="fullName" error={errors.fullName}>
        <input id="fullName" value={value.fullName} onChange={(e) => onChange({ fullName: e.target.value })} />
      </Field>
      <Field label="Email *" name="email" error={errors.email}>
        <input id="email" type="email" value={value.email} onChange={(e) => onChange({ email: e.target.value })} />
      </Field>
      <Field label="Phone Number *" name="phone" error={errors.phone}>
        <input id="phone" value={value.phone} onChange={(e) => onChange({ phone: e.target.value })} />
      </Field>
      <Field label="Years of Recruiting Experience *" name="yearsExperience" error={errors.yearsExperience}>
        <input id="yearsExperience" value={value.yearsExperience} onChange={(e) => onChange({ yearsExperience: e.target.value })} placeholder="8" />
      </Field>
      <Field label="Primary Driver Types *" name="primaryDriverTypes" error={errors.primaryDriverTypes}>
        <input id="primaryDriverTypes" value={value.primaryDriverTypes} onChange={(e) => onChange({ primaryDriverTypes: e.target.value })} placeholder="Class A OTR, Reefer" />
      </Field>
      <Field label="Service Area *" name="serviceArea" error={errors.serviceArea}>
        <input id="serviceArea" value={value.serviceArea} onChange={(e) => onChange({ serviceArea: e.target.value })} />
      </Field>
      <Field label="Current Role *" name="currentRole" error={errors.currentRole}>
        <input id="currentRole" value={value.currentRole} onChange={(e) => onChange({ currentRole: e.target.value })} placeholder="Independent CDL Recruiter" />
      </Field>
      <Field label="Password *" name="password" error={errors.password}>
        <input id="password" type="password" value={password} onChange={(e) => onPasswordChange(e.target.value)} autoComplete="new-password" />
      </Field>
      <Field label="Confirm Password *" name="confirmPassword" error={errors.confirmPassword}>
        <input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => onConfirmChange(e.target.value)} autoComplete="new-password" />
      </Field>
    </div>
  );
}
