import { createClient } from "@supabase/supabase-js";
import { getActiveCompanyIdOrNull } from "./activeCompany";
import { readSession } from "./session";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn(
    "[CDL Exchange] Supabase env vars missing. Copy .env.example to .env and add your new project credentials."
  );
}

function attachSessionHeaders(init?: RequestInit): RequestInit {
  const headers = new Headers(init?.headers);
  const session = readSession();
  const companyId = getActiveCompanyIdOrNull() ?? session?.companyId;
  const accountId = session?.id;
  if (companyId) headers.set("x-company-id", companyId);
  if (accountId) headers.set("x-account-id", accountId);
  return { ...init, headers };
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/** Edge Functions CORS only allows standard headers — custom x-company-id breaks browser invoke. */
function globalFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (requestUrl(input).includes("/functions/v1/")) {
    return fetch(input, init);
  }
  return fetch(input, attachSessionHeaders(init));
}

export const supabase = url && anonKey
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      },
      global: {
        fetch: globalFetch
      }
    })
  : null;

export const isSupabaseConfigured = Boolean(supabase);
