import { DEMO_BUYER_ID } from "./constants";

export type SessionUser = {
  id: string;
  name: string;
  plan: string;
  initials: string;
};

const SESSION_KEY = "cdl_exchange_session";
const SIGNED_OUT_KEY = "cdl_exchange_signed_out";

export const DEMO_SESSION: SessionUser = {
  id: DEMO_BUYER_ID,
  name: "RapidHaul Recruiting",
  plan: "Pro Plan",
  initials: "RH"
};

export function readSession(): SessionUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function writeSession(user: SessionUser): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  localStorage.removeItem(SIGNED_OUT_KEY);
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
  localStorage.setItem(SIGNED_OUT_KEY, "1");
}

export function bootstrapSession(): SessionUser | null {
  const existing = readSession();
  if (existing) return existing;
  if (localStorage.getItem(SIGNED_OUT_KEY) === "1") return null;
  writeSession(DEMO_SESSION);
  return DEMO_SESSION;
}

export function isSignedOut(): boolean {
  return localStorage.getItem(SIGNED_OUT_KEY) === "1" && !readSession();
}
