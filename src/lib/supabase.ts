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

export const supabase = url && anonKey
  ? createClient(url, anonKey, {
      global: {
        fetch: (input, init) => fetch(input, attachSessionHeaders(init))
      }
    })
  : null;

export const isSupabaseConfigured = Boolean(supabase);
