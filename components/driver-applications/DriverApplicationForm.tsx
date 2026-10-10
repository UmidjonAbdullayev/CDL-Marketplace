import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { US_STATES } from "../../lib/us-states";
import {
  DRIVER_APPLICATION_SECTIONS,
  driverApplicationCompletion,
  driverApplicationSectionComplete,
  emptyEmploymentHistory,
  emptyReferences,
  parseDriverApplicationForm
} from "../../lib/driver-application-form";
import type { DriverApplicationDocument, DriverApplicationFormData } from "../../types/driver-application-form";

type Props = {
  formData: Record<string, unknown>;
  documents: DriverApplicationDocument[];
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  readOnly?: boolean;
  onIdentityChange?: (patch: { firstName?: string; lastName?: string; email?: string; phone?: string }) => void;
  onFormChange?: (form: DriverApplicationFormData) => void;
  onUploadDocument?: (file: File, label: string) => Promise<void>;
  uploadingDoc?: boolean;
};

function Field({
  label,
  children,
  required
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="form-group">
      <label>
        {label}
        {required ? " *" : ""}
      </label>
      {children}
    </div>
  );
}

export function DriverApplicationForm({
  formData,
  documents,
  firstName,
  lastName,
  email,
  phone,
  readOnly,
  onIdentityChange,
  onFormChange,
  onUploadDocument,
  uploadingDoc
}: Props) {
  const form = useMemo(() => parseDriverApplicationForm(formData), [formData]);
  const hasIdentity = Boolean(firstName.trim() && lastName.trim() && email.trim() && phone.trim());
  const { percent } = driverApplicationCompletion(form, documents.length, hasIdentity);
  const [openSection, setOpenSection] = useState<string>("personal");

  const set = (patch: Partial<DriverApplicationFormData>) => {
    onFormChange?.({ ...form, ...patch });
  };

  const updateEmployment = (idx: number, patch: Partial<NonNullable<DriverApplicationFormData["employmentHistory"]>[number]>) => {
    const employmentHistory = [...(form.employmentHistory ?? emptyEmploymentHistory())];
    employmentHistory[idx] = { ...employmentHistory[idx]!, ...patch };
    set({ employmentHistory });
  };

  const updateReference = (idx: number, patch: Partial<NonNullable<DriverApplicationFormData["references"]>[number]>) => {
    const references = [...(form.references ?? emptyReferences())];
    references[idx] = { ...references[idx]!, ...patch };
    set({ references });
  };

  const renderSectionBody = (sectionId: string) => {
    switch (sectionId) {
      case "personal":
        return (
          <>
            <div className="form-row">
              <Field label="First name" required>
                <input value={firstName} disabled={readOnly} onChange={(e) => onIdentityChange?.({ firstName: e.target.value })} />
              </Field>
              <Field label="Middle name">
                <input value={form.middleName ?? ""} disabled={readOnly} onChange={(e) => set({ middleName: e.target.value })} />
              </Field>
              <Field label="Last name" required>
                <input value={lastName} disabled={readOnly} onChange={(e) => onIdentityChange?.({ lastName: e.target.value })} />
              </Field>
            </div>
            <div className="form-row">
              <Field label="Date of birth">
                <input type="date" value={form.dateOfBirth ?? ""} disabled={readOnly} onChange={(e) => set({ dateOfBirth: e.target.value })} />
              </Field>
              <Field label="SSN (last 4)">
                <input maxLength={4} value={form.ssnLast4 ?? ""} disabled={readOnly} onChange={(e) => set({ ssnLast4: e.target.value })} />
              </Field>
            </div>
            <Field label="Street address">
              <input value={form.streetAddress ?? ""} disabled={readOnly} onChange={(e) => set({ streetAddress: e.target.value })} />
            </Field>
            <div className="form-row">
              <Field label="City">
                <input value={form.city ?? ""} disabled={readOnly} onChange={(e) => set({ city: e.target.value })} />
              </Field>
              <Field label="State">
                <select value={form.state ?? ""} disabled={readOnly} onChange={(e) => set({ state: e.target.value })}>
                  <option value="">Select</option>
                  {US_STATES.map((s) => (
                    <option key={s.code} value={s.code}>{s.code}</option>
                  ))}
                </select>
              </Field>
              <Field label="ZIP">
                <input value={form.zip ?? ""} disabled={readOnly} onChange={(e) => set({ zip: e.target.value })} />
              </Field>
            </div>
          </>
        );
      case "contact":
        return (
          <>
            <div className="form-row">
              <Field label="Email" required>
                <input type="email" value={email} disabled={readOnly} onChange={(e) => onIdentityChange?.({ email: e.target.value })} />
              </Field>
              <Field label="Primary phone" required>
                <input value={phone} disabled={readOnly} onChange={(e) => onIdentityChange?.({ phone: e.target.value })} />
              </Field>
            </div>
            <div className="form-row">
              <Field label="Alternate phone">
                <input value={form.altPhone ?? ""} disabled={readOnly} onChange={(e) => set({ altPhone: e.target.value })} />
              </Field>
              <Field label="Emergency contact">
                <input value={form.emergencyContact ?? ""} disabled={readOnly} onChange={(e) => set({ emergencyContact: e.target.value })} />
              </Field>
              <Field label="Emergency phone">
                <input value={form.emergencyPhone ?? ""} disabled={readOnly} onChange={(e) => set({ emergencyPhone: e.target.value })} />
              </Field>
            </div>
          </>
        );
      case "cdl":
        return (
          <>
            <div className="form-row">
              <Field label="CDL number">
                <input value={form.cdlNumber ?? ""} disabled={readOnly} onChange={(e) => set({ cdlNumber: e.target.value })} />
              </Field>
              <Field label="CDL class">
                <select value={form.cdlClass ?? ""} disabled={readOnly} onChange={(e) => set({ cdlClass: e.target.value })}>
                  <option value="">Select</option>
                  <option>Class A</option>
                  <option>Class B</option>
                  <option>Class C</option>
                </select>
              </Field>
              <Field label="CDL state">
                <select value={form.cdlState ?? ""} disabled={readOnly} onChange={(e) => set({ cdlState: e.target.value })}>
                  <option value="">Select</option>
                  {US_STATES.map((s) => (
                    <option key={s.code} value={s.code}>{s.code}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="form-row">
              <Field label="CDL expiration">
                <input type="date" value={form.cdlExpiration ?? ""} disabled={readOnly} onChange={(e) => set({ cdlExpiration: e.target.value })} />
              </Field>
              <Field label="Medical card expiration">
                <input type="date" value={form.medCardExpiration ?? ""} disabled={readOnly} onChange={(e) => set({ medCardExpiration: e.target.value })} />
              </Field>
            </div>
            <Field label="Endorsements">
              <input value={form.endorsements ?? ""} disabled={readOnly} placeholder="Hazmat, Tanker, TWIC..." onChange={(e) => set({ endorsements: e.target.value })} />
            </Field>
            <div className="form-row">
              <Field label="TWIC card?">
                <select value={form.hasTwic ?? ""} disabled={readOnly} onChange={(e) => set({ hasTwic: e.target.value })}>
                  <option value="">Select</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </Field>
              <Field label="Hazmat?">
                <select value={form.hasHazmat ?? ""} disabled={readOnly} onChange={(e) => set({ hasHazmat: e.target.value })}>
                  <option value="">Select</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </Field>
              <Field label="Tanker?">
                <select value={form.hasTanker ?? ""} disabled={readOnly} onChange={(e) => set({ hasTanker: e.target.value })}>
                  <option value="">Select</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </Field>
            </div>
          </>
        );
      case "experience":
        return (
          <>
            <div className="form-row">
              <Field label="Total years CDL experience">
                <input value={form.totalYearsExp ?? form.experience ?? ""} disabled={readOnly} onChange={(e) => set({ totalYearsExp: e.target.value, experience: e.target.value })} />
              </Field>
              <Field label="OTR experience">
                <input value={form.otrYearsExp ?? ""} disabled={readOnly} onChange={(e) => set({ otrYearsExp: e.target.value })} />
              </Field>
            </div>
            <Field label="Equipment types driven">
              <input value={form.equipmentTypes ?? ""} disabled={readOnly} placeholder="Dry van, reefer, flatbed..." onChange={(e) => set({ equipmentTypes: e.target.value })} />
            </Field>
            <Field label="Preferred freight">
              <input value={form.preferredFreight ?? ""} disabled={readOnly} onChange={(e) => set({ preferredFreight: e.target.value })} />
            </Field>
            <Field label="States / regions run">
              <textarea rows={2} value={form.statesRun ?? ""} disabled={readOnly} onChange={(e) => set({ statesRun: e.target.value })} />
            </Field>
          </>
        );
      case "employment":
        return (
          <div className="driver-app-employment-list">
            {(form.employmentHistory ?? emptyEmploymentHistory()).map((job, idx) => (
              <div key={idx} className="driver-app-employment-block">
                <h4>Employer {idx + 1}</h4>
                <Field label="Company name">
                  <input value={job.employer} disabled={readOnly} onChange={(e) => updateEmployment(idx, { employer: e.target.value })} />
                </Field>
                <div className="form-row">
                  <Field label="From">
                    <input type="month" value={job.from} disabled={readOnly} onChange={(e) => updateEmployment(idx, { from: e.target.value })} />
                  </Field>
                  <Field label="To">
                    <input type="month" value={job.to} disabled={readOnly} onChange={(e) => updateEmployment(idx, { to: e.target.value })} />
                  </Field>
                </div>
                <Field label="Equipment">
                  <input value={job.equipment} disabled={readOnly} onChange={(e) => updateEmployment(idx, { equipment: e.target.value })} />
                </Field>
                <Field label="Reason for leaving">
                  <input value={job.reasonLeaving} disabled={readOnly} onChange={(e) => updateEmployment(idx, { reasonLeaving: e.target.value })} />
                </Field>
                <Field label="Contact phone">
                  <input value={job.contactPhone} disabled={readOnly} onChange={(e) => updateEmployment(idx, { contactPhone: e.target.value })} />
                </Field>
              </div>
            ))}
          </div>
        );
      case "safety":
        return (
          <>
            <div className="form-row">
              <Field label="Accidents in past 3 years?">
                <select value={form.accidentsPast3Years ?? ""} disabled={readOnly} onChange={(e) => set({ accidentsPast3Years: e.target.value })}>
                  <option value="">Select</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </Field>
              <Field label="Moving violations in past 3 years?">
                <select value={form.violationsPast3Years ?? ""} disabled={readOnly} onChange={(e) => set({ violationsPast3Years: e.target.value })}>
                  <option value="">Select</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </Field>
            </div>
            <Field label="Accident details">
              <textarea rows={2} value={form.accidentDetails ?? ""} disabled={readOnly} onChange={(e) => set({ accidentDetails: e.target.value })} />
            </Field>
            <Field label="Violation details">
              <textarea rows={2} value={form.violationDetails ?? ""} disabled={readOnly} onChange={(e) => set({ violationDetails: e.target.value })} />
            </Field>
            <div className="form-row">
              <Field label="License suspensions?">
                <select value={form.licenseSuspensions ?? ""} disabled={readOnly} onChange={(e) => set({ licenseSuspensions: e.target.value })}>
                  <option value="">Select</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </Field>
              <Field label="Failed drug/alcohol test?">
                <select value={form.failedDrugTest ?? ""} disabled={readOnly} onChange={(e) => set({ failedDrugTest: e.target.value })}>
                  <option value="">Select</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </Field>
              <Field label="SAP program completed?">
                <select value={form.sapProgram ?? ""} disabled={readOnly} onChange={(e) => set({ sapProgram: e.target.value })}>
                  <option value="">Select</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                  <option value="na">N/A</option>
                </select>
              </Field>
            </div>
          </>
        );
      case "criminal":
        return (
          <>
            <div className="form-row">
              <Field label="Felony convictions?">
                <select value={form.felonies ?? ""} disabled={readOnly} onChange={(e) => set({ felonies: e.target.value })}>
                  <option value="">Select</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </Field>
              <Field label="Misdemeanor convictions?">
                <select value={form.misdemeanors ?? ""} disabled={readOnly} onChange={(e) => set({ misdemeanors: e.target.value })}>
                  <option value="">Select</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </Field>
              <Field label="DUI / DWI?">
                <select value={form.dui ?? ""} disabled={readOnly} onChange={(e) => set({ dui: e.target.value })}>
                  <option value="">Select</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </Field>
            </div>
            <Field label="Felony details">
              <textarea rows={2} value={form.felonyDetails ?? ""} disabled={readOnly} onChange={(e) => set({ felonyDetails: e.target.value })} />
            </Field>
            <Field label="Misdemeanor details">
              <textarea rows={2} value={form.misdemeanorDetails ?? ""} disabled={readOnly} onChange={(e) => set({ misdemeanorDetails: e.target.value })} />
            </Field>
            <Field label="DUI details">
              <textarea rows={2} value={form.duiDetails ?? ""} disabled={readOnly} onChange={(e) => set({ duiDetails: e.target.value })} />
            </Field>
          </>
        );
      case "preferences":
        return (
          <>
            <div className="form-row">
              <Field label="Driver type">
                <input value={form.driverType ?? ""} disabled={readOnly} placeholder="Company, owner-op, lease..." onChange={(e) => set({ driverType: e.target.value })} />
              </Field>
              <Field label="Desired pay">
                <input value={form.desiredPay ?? ""} disabled={readOnly} onChange={(e) => set({ desiredPay: e.target.value })} />
              </Field>
            </div>
            <div className="form-row">
              <Field label="Home time preference">
                <input value={form.homeTimePref ?? ""} disabled={readOnly} onChange={(e) => set({ homeTimePref: e.target.value })} />
              </Field>
              <Field label="Available start date">
                <input type="date" value={form.availableDate ?? ""} disabled={readOnly} onChange={(e) => set({ availableDate: e.target.value })} />
              </Field>
            </div>
            <div className="form-row">
              <Field label="Open to team driving?">
                <select value={form.teamDriver ?? ""} disabled={readOnly} onChange={(e) => set({ teamDriver: e.target.value })}>
                  <option value="">Select</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </Field>
              <Field label="Owner-operator?">
                <select value={form.ownerOperator ?? ""} disabled={readOnly} onChange={(e) => set({ ownerOperator: e.target.value })}>
                  <option value="">Select</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </Field>
            </div>
            <Field label="Additional notes">
              <textarea rows={2} value={form.additionalNotes ?? ""} disabled={readOnly} onChange={(e) => set({ additionalNotes: e.target.value })} />
            </Field>
          </>
        );
      case "references":
        return (
          <div className="driver-app-references-list">
            {(form.references ?? emptyReferences()).map((ref, idx) => (
              <div key={idx} className="driver-app-reference-block">
                <h4>Reference {idx + 1}</h4>
                <Field label="Name">
                  <input value={ref.name} disabled={readOnly} onChange={(e) => updateReference(idx, { name: e.target.value })} />
                </Field>
                <div className="form-row">
                  <Field label="Phone">
                    <input value={ref.phone} disabled={readOnly} onChange={(e) => updateReference(idx, { phone: e.target.value })} />
                  </Field>
                  <Field label="Relationship">
                    <input value={ref.relation} disabled={readOnly} onChange={(e) => updateReference(idx, { relation: e.target.value })} />
                  </Field>
                </div>
              </div>
            ))}
          </div>
        );
      case "documents":
        return (
          <>
            {documents.length > 0 ? (
              <ul className="driver-app-doc-list">
                {documents.map((doc) => (
                  <li key={doc.id}>
                    <strong>{doc.label}</strong> — {doc.fileName}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="t-caption t-secondary">No documents uploaded yet.</p>
            )}
            {!readOnly && onUploadDocument ? (
              <div className="driver-app-doc-upload">
                <label className="btn btn-secondary btn-sm">
                  {uploadingDoc ? "Uploading..." : "Upload document"}
                  <input
                    type="file"
                    hidden
                    disabled={uploadingDoc}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void onUploadDocument(file, "Application document");
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            ) : null}
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="driver-application-form">
      <div className="carrier-offers-progress driver-app-progress">
        <div className="carrier-offers-progress-track">
          <div className="carrier-offers-progress-fill" style={{ width: `${percent}%` }} />
        </div>
        <span className="t-caption">{percent}% complete</span>
      </div>

      <div className="driver-app-sections">
        {DRIVER_APPLICATION_SECTIONS.map((section) => {
          const complete = driverApplicationSectionComplete(section.id, form, documents.length);
          const isOpen = openSection === section.id;
          return (
            <div key={section.id} className={`driver-app-section card ${complete ? "is-complete" : ""}`}>
              <button
                type="button"
                className="driver-app-section-head"
                onClick={() => setOpenSection(isOpen ? "" : section.id)}
              >
                <div>
                  <strong>{section.title}</strong>
                  <span className="t-caption t-secondary">{section.description}</span>
                </div>
                <div className="driver-app-section-meta">
                  {complete ? <span className="badge badge-green">Complete</span> : <span className="badge badge-gray">Incomplete</span>}
                  {isOpen ? <ChevronUp className="icon-sm" /> : <ChevronDown className="icon-sm" />}
                </div>
              </button>
              {isOpen ? <div className="driver-app-section-body card-body">{renderSectionBody(section.id)}</div> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DriverApplicationReadOnlySummary({
  formData,
  documents,
  firstName,
  lastName,
  email,
  phone
}: Pick<Props, "formData" | "documents" | "firstName" | "lastName" | "email" | "phone">) {
  return (
    <DriverApplicationForm
      formData={formData}
      documents={documents}
      firstName={firstName}
      lastName={lastName}
      email={email}
      phone={phone}
      readOnly
    />
  );
}
