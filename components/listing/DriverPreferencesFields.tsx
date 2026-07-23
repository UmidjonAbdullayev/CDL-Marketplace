import { WEEKS_OUT_OPTIONS, isOwnerStyleDriverType } from "../../lib/driver-preferences";

export type DriverPreferencesFieldValues = {
  desiredWeeklyPay: string;
  weeksOutPreference: string;
  maxDispatchFeePct: number | "";
  companyExpectations: string;
};

type Props = {
  driverType: string;
  values: DriverPreferencesFieldValues;
  onChange: (patch: Partial<DriverPreferencesFieldValues>) => void;
};

export function DriverPreferencesFields({ driverType, values, onChange }: Props) {
  const showDispatch = isOwnerStyleDriverType(driverType);

  return (
    <div className="driver-preferences-fields">
      <div className="driver-preferences-intro card" style={{ marginBottom: 16, padding: "var(--s4)" }}>
        <strong>Driver preferences</strong>
        <p className="t-caption t-secondary" style={{ marginTop: 6, marginBottom: 0 }}>
          Tell carriers what this driver is looking for — pay, home time, and company fit. Buyers see this on the
          listing before they register to hire.
        </p>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Target weekly pay *</label>
          <input
            value={values.desiredWeeklyPay}
            onChange={(e) => onChange({ desiredWeeklyPay: e.target.value })}
            placeholder="e.g. $2,500+/week, $0.55+/mile"
          />
          <span className="t-caption t-secondary">What the driver wants to earn (weekly or per mile).</span>
        </div>
        <div className="form-group">
          <label>Weeks out / home time *</label>
          <select
            value={values.weeksOutPreference}
            onChange={(e) => onChange({ weeksOutPreference: e.target.value })}
          >
            <option value="">Select schedule preference</option>
            {WEEKS_OUT_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <span className="t-caption t-secondary">How long they are willing to be out and expected home time.</span>
        </div>
      </div>
      {showDispatch ? (
        <div className="form-group">
          <label>Max dispatch fee % *</label>
          <input
            type="number"
            min={1}
            max={100}
            step={0.5}
            value={values.maxDispatchFeePct}
            onChange={(e) => {
              const raw = e.target.value;
              onChange({ maxDispatchFeePct: raw === "" ? "" : Number(raw) });
            }}
            placeholder="e.g. 12"
          />
          <span className="t-caption t-secondary">
            For owner operators / lease — highest dispatch % the driver will accept.
          </span>
        </div>
      ) : null}
      <div className="form-group">
        <label>What they want from a company</label>
        <textarea
          rows={3}
          value={values.companyExpectations}
          onChange={(e) => onChange({ companyExpectations: e.target.value })}
          placeholder="e.g. No touch freight, newer equipment, paid detention, direct customer freight, pet friendly..."
        />
        <span className="t-caption t-secondary">
          Benefits, freight type, equipment age, team vs solo, or other deal-breakers.
        </span>
      </div>
    </div>
  );
}
