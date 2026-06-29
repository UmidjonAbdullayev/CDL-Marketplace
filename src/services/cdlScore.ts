import { supabase } from "../lib/supabase";
import type { CarrierPlanId } from "../types/registration";
import { searchCreditsForPlan } from "../lib/carrier-plans";

export type CdlScoreDriverResult = {
  id: string;
  full_name: string;
  score: number;
  reliability_pct: number;
  drug_test_pct: number;
  on_time_pct: number;
  flag: string;
  stars: number;
};

export type CdlScoreSearchResponse = {
  success: boolean;
  drivers: CdlScoreDriverResult[];
  creditsLeft: number;
  error?: string;
};

export type ProvisionCdlScorePayload = {
  email: string;
  password: string;
  companyName: string;
  mcNumber?: string;
  contactName?: string;
  plan?: CarrierPlanId | null;
  searchCredits?: number;
  grantPlanCreditsIfDue?: boolean;
};

function formatInvokeError(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message;
    if (msg.includes("Failed to send a request to the Edge Function")) {
      return "Could not reach the CDL Score edge function. Redeploy provision-cdl-score on Supabase and check your network connection.";
    }
    return msg;
  }
  return "Edge function request failed";
}

async function parseInvokeResult(data: unknown, error: unknown): Promise<{
  success: boolean;
  credits?: number;
  error?: string;
}> {
  if (error) {
    const ctx = error as { context?: Response };
    if (ctx.context && typeof ctx.context.json === "function") {
      try {
        const body = (await ctx.context.json()) as { error?: string; message?: string };
        const detail = body?.error ?? body?.message;
        if (detail) return { success: false, error: detail };
      } catch {
        /* ignore parse errors */
      }
    }
    return { success: false, error: formatInvokeError(error) };
  }

  const result = data as { success?: boolean; credits?: number; error?: string };
  if (!result?.success) {
    return { success: false, error: result?.error ?? "CDL Score provisioning failed" };
  }
  return { success: true, credits: result.credits };
}

export async function provisionCdlScoreAccount(payload: ProvisionCdlScorePayload): Promise<{
  success: boolean;
  credits?: number;
  error?: string;
}> {
  if (!supabase) return { success: false, error: "Supabase not configured" };

  const searchCredits = payload.searchCredits ?? searchCreditsForPlan(payload.plan ?? "free");

  const { data, error } = await supabase.functions.invoke("provision-cdl-score", {
    body: {
      email: payload.email.trim().toLowerCase(),
      password: payload.password,
      companyName: payload.companyName,
      mcNumber: payload.mcNumber?.trim() || "PENDING",
      contactName: payload.contactName?.trim() || payload.companyName,
      searchCredits,
      grantPlanCreditsIfDue: Boolean(payload.grantPlanCreditsIfDue)
    }
  });

  const parsed = await parseInvokeResult(data, error);
  if (!parsed.success) return parsed;
  return { success: true, credits: parsed.credits ?? searchCredits };
}

export async function syncCdlScorePlanCredits(
  plan: CarrierPlanId,
  targetRegistrationId?: string
): Promise<{ success: boolean; credits?: number; error?: string }> {
  if (!supabase) return { success: false, error: "Supabase not configured" };
  const searchCredits = searchCreditsForPlan(plan);
  const { data, error } = await supabase.functions.invoke("provision-cdl-score", {
    body: { syncCreditsOnly: true, searchCredits, plan, targetRegistrationId }
  });
  return parseInvokeResult(data, error);
}

export async function refreshCdlScoreCreditsFromServer(): Promise<number> {
  if (!supabase) return 0;
  const { data, error } = await supabase.functions.invoke("provision-cdl-score", {
    body: { refreshCreditsOnly: true }
  });
  if (error) return 0;
  const result = data as { success?: boolean; credits?: number };
  return result?.success ? Number(result.credits ?? 0) : 0;
}

export async function searchDriverOnCdlScore(driverName: string): Promise<CdlScoreSearchResponse> {
  if (!supabase) {
    return { success: false, drivers: [], creditsLeft: 0, error: "Supabase not configured" };
  }

  const { data, error } = await supabase.functions.invoke("cdl-score-driver-search", {
    body: { driverName: driverName.trim() }
  });

  if (error) {
    return { success: false, drivers: [], creditsLeft: 0, error: error.message };
  }

  return data as CdlScoreSearchResponse;
}

export async function fetchLocalCdlScoreCredits(): Promise<number> {
  if (!supabase) return 0;
  const { data } = await supabase.from("companies").select("cdl_score_search_credits").maybeSingle();
  return Number(data?.cdl_score_search_credits ?? 0);
}

export { CDL_SCORE_APP_URL, CDL_SCORE_REGISTER_URL, buildCdlScoreDriverSearchUrl } from "../lib/cdl-score-urls";
