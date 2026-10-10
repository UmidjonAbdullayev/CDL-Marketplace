import type { DriverCard } from "../types";
import type { ScoreFlag } from "../types";

export const DRIVER_AVATAR_COLORS = ["#DBEAFE", "#D1FAE5", "#E9D5FF", "#FEF3C7", "#FCE7F3"];
export const DRIVER_AVATAR_TEXT = ["#2563EB", "#059669", "#7C3AED", "#D97706", "#DB2777"];

export function driverAvatarColors(id: number): { bg: string; fg: string } {
  const idx = id % DRIVER_AVATAR_COLORS.length;
  return { bg: DRIVER_AVATAR_COLORS[idx], fg: DRIVER_AVATAR_TEXT[idx] };
}

export function scoreToCdlScore(score: ScoreFlag): string {
  if (score === "green") return "4.8";
  if (score === "yellow") return "4.5";
  return "4.1";
}

export function driverAvailabilityClass(avail: string): string {
  const diff = new Date(avail).getTime() - Date.now();
  if (diff <= 86400000 * 7) return "avail-now";
  return "avail-open";
}

export function driverAvailabilityLabel(avail: string): string {
  const diff = new Date(avail).getTime() - Date.now();
  if (diff <= 86400000 * 7) return "Available now";
  return "Open to offers";
}

export function driverCardBio(driver: DriverCard): string {
  const route = driver.companyExpectations ? `${driver.companyExpectations} routes` : "stable carrier roles";
  const pay = driver.desiredWeeklyPay ? ` Target pay: ${driver.desiredWeeklyPay}.` : "";
  return `Experienced ${driver.cdl} driver with ${driver.expLabel} specializing in ${driver.equip}. Looking for ${route} with strong home time.${pay}`;
}

export function driverFooterTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${Math.max(1, mins)} hrs ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hrs ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
