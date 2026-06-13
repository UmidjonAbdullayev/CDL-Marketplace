import type { DriverCard } from "../types";

type NameLike = Pick<DriverCard, "first" | "last">;

export function fmtPrice(n: number): string {
  return `$${n.toLocaleString()}`;
}

export function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

export function fmtPostedAt(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just posted";
  if (mins < 60) return `Posted ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Posted ${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `Posted ${days}d ago`;
  return `Posted ${fmtDate(iso)}`;
}

export function fullName(driver: { first: string; last: string }): string {
  return `${driver.first} ${driver.last}`;
}

export function fmtRecruitingFee(n: number): string {
  return fmtPrice(n);
}

export function maskName(driver: NameLike): string {
  return `${driver.first} ${driver.last[0]}.`;
}

export function driverInitials(driver: NameLike): string {
  return `${driver.first[0]}${driver.last[0]}`.toUpperCase();
}
