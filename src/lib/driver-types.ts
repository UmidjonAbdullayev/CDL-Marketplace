export const DRIVER_TYPES = [
  "Company Driver",
  "Team",
  "Lease",
  "Owner Operator"
] as const;

export type DriverType = (typeof DRIVER_TYPES)[number];

export const POSTED_WITHIN_OPTIONS = [
  { value: "", label: "Any time" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" }
] as const;

export type PostedWithin = "" | "24h" | "7d" | "30d" | "90d";

export function postedWithinSince(value: PostedWithin): string | undefined {
  if (!value) return undefined;
  const ms =
    value === "24h" ? 86400000
      : value === "7d" ? 7 * 86400000
        : value === "30d" ? 30 * 86400000
          : 90 * 86400000;
  return new Date(Date.now() - ms).toISOString();
}
