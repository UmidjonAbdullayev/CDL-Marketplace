import {
  EXPERIENCE_MONTH_OPTIONS,
  EXPERIENCE_YEAR_OPTIONS,
  formatDriverExperience
} from "../../lib/driver-experience";

type Props = {
  years: number | "";
  months: number | "";
  onYearsChange: (value: number | "") => void;
  onMonthsChange: (value: number | "") => void;
  required?: boolean;
  showPreview?: boolean;
};

export function DriverExperienceFields({
  years,
  months,
  onYearsChange,
  onMonthsChange,
  required = true,
  showPreview = true
}: Props) {
  const preview =
    years !== "" && months !== ""
      ? formatDriverExperience(Number(years), Number(months))
      : null;

  return (
    <div className="experience-fields">
      <div className="form-group">
        <label>{required ? "Years of experience *" : "Years of experience"}</label>
        <select
          value={years === "" ? "" : String(years)}
          onChange={(e) => onYearsChange(e.target.value === "" ? "" : Number(e.target.value))}
        >
          <option value="">Select years</option>
          {EXPERIENCE_YEAR_OPTIONS.map((y) => (
            <option key={y} value={y}>
              {y === 0 ? "0 years" : y === 1 ? "1 year" : `${y} years`}
            </option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label>{required ? "Months of experience *" : "Months of experience"}</label>
        <select
          value={months === "" ? "" : String(months)}
          onChange={(e) => onMonthsChange(e.target.value === "" ? "" : Number(e.target.value))}
        >
          <option value="">Select months</option>
          {EXPERIENCE_MONTH_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m === 0 ? "0 months" : m === 1 ? "1 month" : `${m} months`}
            </option>
          ))}
        </select>
      </div>
      {showPreview && preview ? (
        <p className="experience-fields-preview t-caption">
          Shown to buyers as: <strong>{preview}</strong>
        </p>
      ) : null}
    </div>
  );
}
