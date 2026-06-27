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
};

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
      searchCredits
    }
  });

  if (error) {
    return { success: false, error: error.message };
  }

  const result = data as { success?: boolean; credits?: number; error?: string };
  if (!result?.success) {
    return { success: false, error: result?.error ?? "CDL Score provisioning failed" };
  }

  return { success: true, credits: result.credits ?? searchCredits };
}

export async function syncCdlScorePlanCredits(plan: CarrierPlanId, targetRegistrationId?: string): Promise<boolean> {
  if (!supabase) return false;
  const searchCredits = searchCreditsForPlan(plan);
  const { data, error } = await supabase.functions.invoke("provision-cdl-score", {
    body: { syncCreditsOnly: true, searchCredits, plan, targetRegistrationId }
  });
  if (error) return false;
  return Boolean((data as { success?: boolean })?.success);
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

export { CDL_SCORE_APP_URL, CDL_SCORE_REGISTER_URL } from "../lib/cdl-score-urls";
