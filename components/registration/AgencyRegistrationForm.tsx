import type { ReactNode } from "react";
import { US_STATES } from "../../lib/us-states";
import type { AgencyProfile } from "../../types/registration";
import type { FieldErrors } from "../../lib/registration-validation";

type Props = {
  value: AgencyProfile;
  errors: FieldErrors;
  password: string;
  confirmPassword: string;
  onChange: (patch: Partial<AgencyProfile>) => void;
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

export function AgencyRegistrationForm({
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
      <Field label="Agency Name *" name="agencyName" error={errors.agencyName}>
        <input id="agencyName" value={value.agencyName} onChange={(e) => onChange({ agencyName: e.target.value })} placeholder="Prime Driver Leads LLC" />
      </Field>
      <Field label="Company Email *" name="companyEmail" error={errors.companyEmail}>
        <input id="companyEmail" type="email" value={value.companyEmail} onChange={(e) => onChange({ companyEmail: e.target.value })} />
      </Field>
      <Field label="Phone Number *" name="phone" error={errors.phone}>
        <input id="phone" value={value.phone} onChange={(e) => onChange({ phone: e.target.value })} />
      </Field>
      <Field label="Website *" name="website" error={errors.website}>
        <input id="website" value={value.website} onChange={(e) => onChange({ website: e.target.value })} />
      </Field>
      <Field label="Contact Person Name *" name="contactPersonName" error={errors.contactPersonName}>
        <input id="contactPersonName" value={value.contactPersonName} onChange={(e) => onChange({ contactPersonName: e.target.value })} />
      </Field>
      <Field label="Contact Person Role *" name="contactPersonRole" error={errors.contactPersonRole}>
        <input id="contactPersonRole" value={value.contactPersonRole} onChange={(e) => onChange({ contactPersonRole: e.target.value })} />
      </Field>
      <Field label="Specialization *" name="specialization" error={errors.specialization}>
        <input id="specialization" value={value.specialization} onChange={(e) => onChange({ specialization: e.target.value })} placeholder="Class A OTR, Reefer, Flatbed" />
      </Field>
      <Field label="Service Area *" name="serviceArea" error={errors.serviceArea}>
        <input id="serviceArea" value={value.serviceArea} onChange={(e) => onChange({ serviceArea: e.target.value })} />
      </Field>
      <Field label="Years in Business *" name="yearsInBusiness" error={errors.yearsInBusiness}>
        <input id="yearsInBusiness" value={value.yearsInBusiness} onChange={(e) => onChange({ yearsInBusiness: e.target.value })} placeholder="5" />
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
        <input id="zip" value={value.zip} onChange={(e) => onChange({ zip: e.target.value })} />
      </Field>
      <Field label="Average Monthly Driver Leads" name="avgMonthlyLeads" error={errors.avgMonthlyLeads}>
        <input id="avgMonthlyLeads" value={value.avgMonthlyLeads ?? ""} onChange={(e) => onChange({ avgMonthlyLeads: e.target.value })} placeholder="Optional" />
      </Field>
      <Field label="Primary Driver Types" name="primaryDriverTypes" error={errors.primaryDriverTypes}>
        <input id="primaryDriverTypes" value={value.primaryDriverTypes ?? ""} onChange={(e) => onChange({ primaryDriverTypes: e.target.value })} placeholder="Optional" />
      </Field>
      <div className="form-group reg-form-full">
        <label htmlFor="about">About Agency</label>
        <textarea id="about" rows={3} value={value.about ?? ""} onChange={(e) => onChange({ about: e.target.value })} />
      </div>
      <div className="form-group reg-form-full">
        <label>Logo Upload</label>
        <div className="upload-zone reg-upload-placeholder" onClick={() => undefined}>
          <span className="t-secondary">Logo upload available after account approval</span>
        </div>
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
