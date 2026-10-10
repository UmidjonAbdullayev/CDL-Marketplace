/** Month options for CDL driving experience (0–11). */
export const EXPERIENCE_MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i);

/** Year options for CDL driving experience (0–50). */
export const EXPERIENCE_YEAR_OPTIONS = Array.from({ length: 51 }, (_, i) => i);

export function clampExperienceMonths(months: number): number {
  return Math.max(0, Math.min(11, Math.floor(months)));
}

export function clampExperienceYears(years: number): number {
  return Math.max(0, Math.min(50, Math.floor(years)));
}

export function totalExperienceMonths(years: number, months: number): number {
  return clampExperienceYears(years) * 12 + clampExperienceMonths(months);
}

/** Human-readable label for cards and detail views. */
export function formatDriverExperience(years: number, months: number): string {
  const y = clampExperienceYears(years);
  const m = clampExperienceMonths(months);

  if (y === 0 && m === 0) return "In training";
  if (y === 0) return m === 1 ? "1 month" : `${m} months`;
  if (m === 0) return y === 1 ? "1 year" : `${y} years`;

  const yearPart = y === 1 ? "1 yr" : `${y} yrs`;
  const monthPart = m === 1 ? "1 mo" : `${m} mo`;
  return `${yearPart} ${monthPart}`;
}

/** Compact label for tight card meta rows. */
export function formatDriverExperienceShort(years: number, months: number): string {
  const y = clampExperienceYears(years);
  const m = clampExperienceMonths(months);

  if (y === 0 && m === 0) return "Training";
  if (y === 0) return `${m} mo`;
  if (m === 0) return y === 1 ? "1 yr" : `${y} yrs`;
  return `${y}y ${m}m`;
}

/** Fields for Driver / DriverCard models. */
export function driverExperienceFields(years: number, months = 0) {
  const expYears = clampExperienceYears(years);
  const expMonths = clampExperienceMonths(months);
  return {
    exp: expYears,
    expYears,
    expMonths,
    expLabel: formatDriverExperience(expYears, expMonths)
  };
}
