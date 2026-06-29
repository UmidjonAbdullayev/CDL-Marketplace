const BASE = (import.meta.env.VITE_CDL_SCORE_APP_URL ?? "https://app-cdl-score.vercel.app").replace(/\/$/, "");

/** Live CDL Score web app (search, signup, login). */
export const CDL_SCORE_APP_URL = BASE;

/** Registration entry — same app; signup is in-app. */
export const CDL_SCORE_REGISTER_URL =
  (import.meta.env.VITE_CDL_SCORE_REGISTER_URL ?? BASE).replace(/\/$/, "");

/** Open CDL Score with a driver name pre-filled and auto-search triggered after sign-in. */
export function buildCdlScoreDriverSearchUrl(driverName: string): string {
  const params = new URLSearchParams({
    search: driverName.trim(),
    autosearch: "1"
  });
  return `${BASE}/?${params.toString()}`;
}
