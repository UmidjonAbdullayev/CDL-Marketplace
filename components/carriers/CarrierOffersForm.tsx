import { Plus, Trash2 } from "lucide-react";
import type { CarrierOffersRequirements, CustomTextSection, FelonyPolicy, HireTaxType, YesNo } from "../../types/carrier-offers";

type Props = {
  value: CarrierOffersRequirements;
  onChange: (next: CarrierOffersRequirements) => void;
  disabled?: boolean;
};

function Field({
  label,
  children,
  hint
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="form-group carrier-offers-field">
      <label>{label}</label>
      {children}
      {hint ? <span className="t-caption t-secondary">{hint}</span> : null}
    </div>
  );
}

function YesNoSelect({
  value,
  onChange,
  disabled
}: {
  value: YesNo;
  onChange: (v: YesNo) => void;
  disabled?: boolean;
}) {
  return (
    <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as YesNo)}>
      <option value="">Select</option>
      <option value="yes">Yes</option>
      <option value="no">No</option>
    </select>
  );
}

function patch(value: CarrierOffersRequirements, p: Partial<CarrierOffersRequirements>): CarrierOffersRequirements {
  return { ...value, ...p };
}

export function CarrierOffersForm({ value, onChange, disabled }: Props) {
  const set = (p: Partial<CarrierOffersRequirements>) => onChange(patch(value, p));

  const updateCustom = (id: string, p: Partial<CustomTextSection>) => {
    const customSections = (value.customSections ?? []).map((s) => (s.id === id ? { ...s, ...p } : s));
    set({ customSections });
  };

  const addCustom = () => {
    const customSections = [...(value.customSections ?? []), { id: `custom-${Date.now()}`, header: "", body: "" }];
    set({ customSections });
  };

  const removeCustom = (id: string) => {
    const customSections = (value.customSections ?? []).filter((s) => s.id !== id);
    set({ customSections: customSections.length ? customSections : [{ id: "custom-1", header: "", body: "" }] });
  };

  return (
    <div className="carrier-offers-form">
      <section className="carrier-offers-section card">
        <h3>Pay &amp; compensation</h3>
        <div className="form-row">
          <Field label="Minimum driver experience accepted">
            <input value={value.minDriverExperience ?? ""} disabled={disabled} placeholder="e.g. 2 years" onChange={(e) => set({ minDriverExperience: e.target.value })} />
          </Field>
          <Field label="Minimum driver age">
            <input value={value.minDriverAge ?? ""} disabled={disabled} placeholder="e.g. 23" onChange={(e) => set({ minDriverAge: e.target.value })} />
          </Field>
        </div>
        <div className="form-row">
          <Field label="Do you hire on 1099 or W-2?">
            <select value={value.hireTaxType ?? ""} disabled={disabled} onChange={(e) => set({ hireTaxType: e.target.value as HireTaxType })}>
              <option value="">Select</option>
              <option value="1099">1099</option>
              <option value="w2">W-2</option>
              <option value="both">Both</option>
            </select>
          </Field>
          <Field label="What do you pay drivers?">
            <input value={value.driverPay ?? ""} disabled={disabled} placeholder="e.g. $0.65 CPM" onChange={(e) => set({ driverPay: e.target.value })} />
          </Field>
        </div>
        <Field label="Highest paycheck in previous 6 months">
          <input value={value.highestPaycheck6Months ?? ""} disabled={disabled} placeholder="e.g. $2,800/week" onChange={(e) => set({ highestPaycheck6Months: e.target.value })} />
        </Field>
        <Field label="Escrow details">
          <input value={value.escrowDetails ?? ""} disabled={disabled} placeholder="e.g. $2,000 – 10 paychecks" onChange={(e) => set({ escrowDetails: e.target.value })} />
        </Field>
        <Field label="Bonuses">
          <textarea rows={2} value={value.bonuses ?? ""} disabled={disabled} placeholder="Safety, referral, etc." onChange={(e) => set({ bonuses: e.target.value })} />
        </Field>
      </section>

      <section className="carrier-offers-section card">
        <h3>Operations &amp; home time</h3>
        <div className="form-row">
          <Field label="Do you modify logs?">
            <YesNoSelect value={value.modifiesLogs ?? ""} disabled={disabled} onChange={(v) => set({ modifiesLogs: v })} />
          </Field>
          <Field label="Top mileage per week">
            <input value={value.topMileagePerWeek ?? ""} disabled={disabled} placeholder="e.g. 4,000" onChange={(e) => set({ topMileagePerWeek: e.target.value })} />
          </Field>
        </div>
        <Field label="Time on the road and at home">
          <input value={value.timeOnRoadAndHome ?? ""} disabled={disabled} placeholder="e.g. 4 weeks out, 4–5 days home" onChange={(e) => set({ timeOnRoadAndHome: e.target.value })} />
        </Field>
        <Field label="48 states or dedicated lanes?">
          <textarea rows={2} value={value.statesOrLanes ?? ""} disabled={disabled} placeholder="Lanes, regions, dedicated routes" onChange={(e) => set({ statesOrLanes: e.target.value })} />
        </Field>
        <Field label="Transportation &amp; accommodation for drivers">
          <textarea rows={2} value={value.transportationAccommodation ?? ""} disabled={disabled} placeholder="Flights, Uber, hotels..." onChange={(e) => set({ transportationAccommodation: e.target.value })} />
        </Field>
      </section>

      <section className="carrier-offers-section card">
        <h3>Fleet &amp; equipment</h3>
        <Field label="Trailers">
          <input value={value.trailerTypes ?? ""} disabled={disabled} placeholder="Dry Van, Reefer..." onChange={(e) => set({ trailerTypes: e.target.value })} />
        </Field>
        <Field label="Truck year / make / model / mileage">
          <textarea rows={2} value={value.truckYearMakeModelMileage ?? ""} disabled={disabled} onChange={(e) => set({ truckYearMakeModelMileage: e.target.value })} />
        </Field>
        <Field label="Truck features">
          <input value={value.truckFeatures ?? ""} disabled={disabled} placeholder="Inverter, fridge..." onChange={(e) => set({ truckFeatures: e.target.value })} />
        </Field>
        <div className="form-row">
          <Field label="Trucks governed?">
            <YesNoSelect value={value.trucksGoverned ?? ""} disabled={disabled} onChange={(v) => set({ trucksGoverned: v })} />
          </Field>
          {value.trucksGoverned === "yes" ? (
            <Field label="Governed speed limit">
              <input value={value.governedSpeedLimit ?? ""} disabled={disabled} placeholder="e.g. 72 mph" onChange={(e) => set({ governedSpeedLimit: e.target.value })} />
            </Field>
          ) : null}
        </div>
        <div className="form-row">
          <Field label="Passengers allowed?">
            <YesNoSelect value={value.allowPassengers ?? ""} disabled={disabled} onChange={(v) => set({ allowPassengers: v })} />
          </Field>
          <Field label="Pets allowed?">
            <YesNoSelect value={value.allowPets ?? ""} disabled={disabled} onChange={(v) => set({ allowPets: v })} />
          </Field>
        </div>
        <Field label="Do you provide (fuel cards, etc.)?">
          <input value={value.providedItems ?? ""} disabled={disabled} onChange={(e) => set({ providedItems: e.target.value })} />
        </Field>
      </section>

      <section className="carrier-offers-section card">
        <h3>Driver types &amp; fees</h3>
        <p className="t-caption t-secondary">What kinds of drivers are you looking for?</p>
        <div className="carrier-offers-check-grid">
          <label className="filters-check"><input type="checkbox" disabled={disabled} checked={Boolean(value.lookingForCompanyDrivers)} onChange={(e) => set({ lookingForCompanyDrivers: e.target.checked })} /> Company drivers</label>
          <label className="filters-check"><input type="checkbox" disabled={disabled} checked={Boolean(value.lookingForOwnerOperators)} onChange={(e) => set({ lookingForOwnerOperators: e.target.checked })} /> Owner operators</label>
          <label className="filters-check"><input type="checkbox" disabled={disabled} checked={Boolean(value.lookingForLeaseDrivers)} onChange={(e) => set({ lookingForLeaseDrivers: e.target.checked })} /> Lease drivers</label>
          <label className="filters-check"><input type="checkbox" disabled={disabled} checked={Boolean(value.lookingForTeamDrivers)} onChange={(e) => set({ lookingForTeamDrivers: e.target.checked })} /> Team drivers</label>
        </div>
        <div className="form-row">
          <Field label="Dispatch fee (owner ops)"><input value={value.dispatchFee ?? ""} disabled={disabled} onChange={(e) => set({ dispatchFee: e.target.value })} /></Field>
          <Field label="Other owner op fees"><input value={value.ownerOpFees ?? ""} disabled={disabled} onChange={(e) => set({ ownerOpFees: e.target.value })} /></Field>
        </div>
        <div className="form-row">
          <Field label="Lease fees"><input value={value.leaseFees ?? ""} disabled={disabled} onChange={(e) => set({ leaseFees: e.target.value })} /></Field>
          <Field label="Team driver fees"><input value={value.teamFees ?? ""} disabled={disabled} onChange={(e) => set({ teamFees: e.target.value })} /></Field>
        </div>
        <Field label="Additional driver type notes">
          <textarea rows={2} value={value.driverTypesNotes ?? ""} disabled={disabled} onChange={(e) => set({ driverTypesNotes: e.target.value })} />
        </Field>
      </section>

      <section className="carrier-offers-section card">
        <h3>Hiring requirements</h3>
        <div className="form-row">
          <Field label="Minimum age"><input value={value.minAge ?? ""} disabled={disabled} onChange={(e) => set({ minAge: e.target.value })} /></Field>
          <Field label="Minimum CDL experience"><input value={value.minCdlExperience ?? ""} disabled={disabled} onChange={(e) => set({ minCdlExperience: e.target.value })} /></Field>
          <Field label="Minimum OTR experience"><input value={value.minOtrExperience ?? ""} disabled={disabled} onChange={(e) => set({ minOtrExperience: e.target.value })} /></Field>
        </div>
        <Field label="Accepted states">
          <input value={value.acceptedStates ?? ""} disabled={disabled} placeholder="States or exclusions" onChange={(e) => set({ acceptedStates: e.target.value })} />
        </Field>
        <div className="form-row">
          <Field label="Max PSP violations"><input value={value.maxPspViolations ?? ""} disabled={disabled} onChange={(e) => set({ maxPspViolations: e.target.value })} /></Field>
          <Field label="Max preventable accidents"><input value={value.maxPreventableAccidents ?? ""} disabled={disabled} onChange={(e) => set({ maxPreventableAccidents: e.target.value })} /></Field>
          <Field label="Max moving violations"><input value={value.maxMovingViolations ?? ""} disabled={disabled} onChange={(e) => set({ maxMovingViolations: e.target.value })} /></Field>
        </div>
        <Field label="Drug test history requirements">
          <input value={value.drugTestHistory ?? ""} disabled={disabled} onChange={(e) => set({ drugTestHistory: e.target.value })} />
        </Field>
        <div className="form-row">
          <Field label="SAP accepted?"><YesNoSelect value={value.sapAccepted ?? ""} disabled={disabled} onChange={(v) => set({ sapAccepted: v })} /></Field>
          <Field label="Felonies policy">
            <select value={value.feloniesPolicy ?? ""} disabled={disabled} onChange={(e) => set({ feloniesPolicy: e.target.value as FelonyPolicy })}>
              <option value="">Select</option>
              <option value="accepted">Accepted</option>
              <option value="case_by_case">Case by case</option>
              <option value="no">No</option>
            </select>
          </Field>
        </div>
        <div className="form-row">
          <Field label="Misdemeanors policy"><input value={value.misdemeanorsPolicy ?? ""} disabled={disabled} onChange={(e) => set({ misdemeanorsPolicy: e.target.value })} /></Field>
          <Field label="DUI policy"><input value={value.duiPolicy ?? ""} disabled={disabled} onChange={(e) => set({ duiPolicy: e.target.value })} /></Field>
        </div>
        <div className="carrier-offers-check-grid">
          <Field label="Manual transmission?"><YesNoSelect value={value.manualTransmissionRequired ?? ""} disabled={disabled} onChange={(v) => set({ manualTransmissionRequired: v })} /></Field>
          <Field label="TWIC required?"><YesNoSelect value={value.twicRequired ?? ""} disabled={disabled} onChange={(v) => set({ twicRequired: v })} /></Field>
          <Field label="Hazmat required?"><YesNoSelect value={value.hazmatRequired ?? ""} disabled={disabled} onChange={(v) => set({ hazmatRequired: v })} /></Field>
          <Field label="Tanker required?"><YesNoSelect value={value.tankerRequired ?? ""} disabled={disabled} onChange={(v) => set({ tankerRequired: v })} /></Field>
          <Field label="Passport required?"><YesNoSelect value={value.passportRequired ?? ""} disabled={disabled} onChange={(v) => set({ passportRequired: v })} /></Field>
        </div>
        <Field label="Recruiter notes">
          <textarea rows={3} value={value.recruiterNotes ?? ""} disabled={disabled} placeholder="Looking for experienced flatbed drivers, ready within 7 days..." onChange={(e) => set({ recruiterNotes: e.target.value })} />
        </Field>
      </section>

      <section className="carrier-offers-section card">
        <div className="carrier-offers-section-head">
          <h3>Additional sections</h3>
          <button type="button" className="btn btn-secondary btn-sm" disabled={disabled} onClick={addCustom}>
            <Plus className="icon-sm" /> Add section
          </button>
        </div>
        <p className="t-caption t-secondary">Add custom headers and details shown on your carrier profile and Find Carriers card.</p>
        {(value.customSections ?? []).map((sec) => (
          <div key={sec.id} className="carrier-offers-custom-block">
            <div className="form-row">
              <Field label="Section header">
                <input value={sec.header} disabled={disabled} placeholder="Required — e.g. Orientation details" onChange={(e) => updateCustom(sec.id, { header: e.target.value })} />
              </Field>
              {(value.customSections?.length ?? 0) > 1 ? (
                <button type="button" className="btn btn-ghost btn-sm carrier-offers-remove" disabled={disabled} onClick={() => removeCustom(sec.id)}>
                  <Trash2 className="icon-sm" />
                </button>
              ) : null}
            </div>
            <Field label="Details">
              <textarea rows={3} value={sec.body} disabled={disabled} placeholder="Describe this offer or requirement..." onChange={(e) => updateCustom(sec.id, { body: e.target.value })} />
            </Field>
          </div>
        ))}
      </section>
    </div>
  );
}
