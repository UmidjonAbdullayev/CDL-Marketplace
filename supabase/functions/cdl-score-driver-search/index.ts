import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const exchangeUrl = Deno.env.get("SUPABASE_URL")!;
    const exchangeServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const exchangeAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const scoreUrl = Deno.env.get("CDL_SCORE_URL");
    const scoreServiceKey = Deno.env.get("CDL_SCORE_SERVICE_ROLE_KEY");

    if (!scoreUrl || !scoreServiceKey) {
      return json({ success: false, drivers: [], creditsLeft: 0, error: "CDL Score integration is not configured." }, 503);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ success: false, drivers: [], creditsLeft: 0, error: "Unauthorized" }, 401);

    const exchangeUserClient = createClient(exchangeUrl, exchangeAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const exchangeAdmin = createClient(exchangeUrl, exchangeServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const scoreAdmin = createClient(scoreUrl, scoreServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: authData, error: authErr } = await exchangeUserClient.auth.getUser();
    if (authErr || !authData.user) {
      return json({ success: false, drivers: [], creditsLeft: 0, error: "Unauthorized" }, 401);
    }

    const { driverName } = await req.json();
    const name = String(driverName ?? "").trim();
    if (!name) {
      return json({ success: false, drivers: [], creditsLeft: 0, error: "Driver name is required" }, 400);
    }

    const { data: account } = await exchangeAdmin
      .from("registration_accounts")
      .select("company_id")
      .eq("auth_user_id", authData.user.id)
      .maybeSingle();

    if (!account?.company_id) {
      return json({ success: false, drivers: [], creditsLeft: 0, error: "Account not found" }, 404);
    }

    const { data: company } = await exchangeAdmin
      .from("companies")
      .select("cdl_score_user_id, cdl_score_search_credits")
      .eq("id", account.company_id)
      .single();

    const scoreUserId = company?.cdl_score_user_id;
    if (!scoreUserId) {
      return json({ success: false, drivers: [], creditsLeft: 0, error: "Link your CDL Score account first." }, 400);
    }

    const { data: creditRow } = await scoreAdmin.rpc("get_user_credits", { target_user_id: scoreUserId });
    const credits = Number((creditRow as { search_credits?: number })?.search_credits ?? 0);
    if (credits <= 0) {
      return json({ success: false, drivers: [], creditsLeft: 0, error: "No CDL Score search credits remaining." }, 402);
    }

    const pattern = `%${name.replace(/[%_\\]/g, "")}%`;
    const { data: drivers, error: searchErr } = await scoreAdmin
      .from("drivers")
      .select("id, full_name, score, reliability_pct, drug_test_pct, on_time_pct, flag, stars")
      .ilike("full_name", pattern)
      .eq("is_synthetic", false)
      .order("score", { ascending: false })
      .limit(5);

    if (searchErr) {
      return json({ success: false, drivers: [], creditsLeft: credits, error: searchErr.message }, 400);
    }

    const { data: decResult, error: decErr } = await scoreAdmin.rpc("decrement_user_credits", {
      target_user_id: scoreUserId
    });

    if (decErr || !(decResult as { success?: boolean })?.success) {
      return json({ success: false, drivers: [], creditsLeft: credits, error: "Could not deduct search credit." }, 400);
    }

    const creditsLeft = Number((decResult as { search_credits?: number })?.search_credits ?? credits - 1);

    await exchangeAdmin
      .from("companies")
      .update({ cdl_score_search_credits: creditsLeft })
      .eq("id", account.company_id);

    return json({
      success: true,
      drivers: drivers ?? [],
      creditsLeft
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return json({ success: false, drivers: [], creditsLeft: 0, error: message }, 500);
  }
});
