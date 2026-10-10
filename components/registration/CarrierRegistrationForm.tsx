import type { ReactNode } from "react";
import { US_STATES } from "../../lib/us-states";
import type { CarrierProfile } from "../../types/registration";
import type { FieldErrors } from "../../lib/registration-validation";

type Props = {
  value: CarrierProfile;
  errors: FieldErrors;
  password: string;
  confirmPassword: string;
  onChange: (patch: Partial<CarrierProfile>) => void;
  onPasswordChange: (password: string) => void;
  onConfirmChange: (confirm: string) => void;
};

function Field({
  label,
  name,
  error,
  children
}: {
  label: string;
  name: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className={`form-group ${error ? "has-error" : ""}`}>
      <label htmlFor={name}>{label}</label>
      {children}
      {error ? <span className="field-error">{error}</span> : null}
    </div>
  );
}

export function CarrierRegistrationForm({
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
      <Field label="Company Name *" name="companyName" error={errors.companyName}>
        <input id="companyName" value={value.companyName} onChange={(e) => onChange({ companyName: e.target.value })} placeholder="FleetSource Agency LLC" />
      </Field>
      <Field label="MC Number *" name="mcNumber" error={errors.mcNumber}>
        <input id="mcNumber" value={value.mcNumber} onChange={(e) => onChange({ mcNumber: e.target.value })} placeholder="MC-892471" />
      </Field>
      <Field label="DOT Number" name="dotNumber" error={errors.dotNumber}>
        <input id="dotNumber" value={value.dotNumber ?? ""} onChange={(e) => onChange({ dotNumber: e.target.value })} placeholder="Optional" />
      </Field>
      <Field label="Company Email *" name="companyEmail" error={errors.companyEmail}>
        <input id="companyEmail" type="email" value={value.companyEmail} onChange={(e) => onChange({ companyEmail: e.target.value })} placeholder="recruiting@company.com" />
      </Field>
      <Field label="Phone Number *" name="phone" error={errors.phone}>
        <input id="phone" value={value.phone} onChange={(e) => onChange({ phone: e.target.value })} placeholder="(555) 123-4567" />
      </Field>
      <Field label="Website *" name="website" error={errors.website}>
        <input id="website" value={value.website} onChange={(e) => onChange({ website: e.target.value })} placeholder="www.company.com" />
      </Field>
      <Field label="Contact Person Name *" name="contactPersonName" error={errors.contactPersonName}>
        <input id="contactPersonName" value={value.contactPersonName} onChange={(e) => onChange({ contactPersonName: e.target.value })} />
      </Field>
      <Field label="Contact Person Role *" name="contactPersonRole" error={errors.contactPersonRole}>
        <input id="contactPersonRole" value={value.contactPersonRole} onChange={(e) => onChange({ contactPersonRole: e.target.value })} placeholder="Director of Recruiting" />
      </Field>
      <Field label="Specialization *" name="specialization" error={errors.specialization}>
        <input id="specialization" value={value.specialization} onChange={(e) => onChange({ specialization: e.target.value })} placeholder="Class A OTR, Tanker, Hazmat" />
      </Field>
      <Field label="Service Area *" name="serviceArea" error={errors.serviceArea}>
        <input id="serviceArea" value={value.serviceArea} onChange={(e) => onChange({ serviceArea: e.target.value })} placeholder="Nationwide" />
      </Field>
      <Field label="Company Size / Fleet Size *" name="fleetSize" error={errors.fleetSize}>
        <input id="fleetSize" value={value.fleetSize} onChange={(e) => onChange({ fleetSize: e.target.value })} placeholder="50-200 trucks" />
      </Field>
      <Field label="Business Address *" name="address" error={errors.address}>
        <input id="address" value={value.address} onChange={(e) => onChange({ address: e.target.value })} />
      </Field>
      <Field label="City *" name="city" error={errors.city}>
        <input id="city" value={value.city} onChange={(e) => onChange({ city: e.target.value })} />
      </Field>
      <Field label="State *" name="state" error={errors.state}>
        <select id="state" value={value.state} onChange={(e) => onChange({ state: e.target.value })}>
          <option value="">Select state</option>
          {US_STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
        </select>
      </Field>
      <Field label="ZIP *" name="zip" error={errors.zip}>
        <input id="zip" value={value.zip} onChange={(e) => onChange({ zip: e.target.value })} placeholder="78701" />
      </Field>
      <div className="form-group reg-form-full">
        <label htmlFor="about">About Company</label>
        <textarea id="about" rows={3} value={value.about ?? ""} onChange={(e) => onChange({ about: e.target.value })} placeholder="Brief company overview..." />
      </div>
      <Field label="Password *" name="password" error={errors.password}>
        <input id="password" type="password" value={password} onChange={(e) => onPasswordChange(e.target.value)} autoComplete="new-password" />
      </Field>
      <Field label="Confirm Password *" name="confirmPassword" error={errors.confirmPassword}>
        <input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => onConfirmChange(e.target.value)} autoComplete="new-password" />
      </Field>
    </div>
  );
}
