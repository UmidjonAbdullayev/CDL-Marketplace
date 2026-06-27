const BASE = (import.meta.env.VITE_CDL_SCORE_APP_URL ?? "https://app-cdl-score.vercel.app").replace(/\/$/, "");

/** Live CDL Score web app (search, signup, login). */
export const CDL_SCORE_APP_URL = BASE;

/** Registration entry — same app; signup is in-app. */
export const CDL_SCORE_REGISTER_URL =
  (import.meta.env.VITE_CDL_SCORE_REGISTER_URL ?? BASE).replace(/\/$/, "");
