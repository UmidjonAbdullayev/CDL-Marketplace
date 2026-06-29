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

async function findScoreUserId(
  scoreAdmin: ReturnType<typeof createClient>,
  email: string
): Promise<string | null> {
  const { data, error } = await scoreAdmin.auth.admin.getUserByEmail(email);
  if (!error && data.user?.id) return data.user.id;

  let page = 1;
  while (page <= 10) {
    const list = await scoreAdmin.auth.admin.listUsers({ page, perPage: 200 });
    const match = list.data.users.find((u) => u.email?.toLowerCase() === email);
    if (match?.id) return match.id;
    if (list.data.users.length < 200) break;
    page += 1;
  }
  return null;
}

async function syncScoreCredits(
  scoreAdmin: ReturnType<typeof createClient>,
  scoreUserId: string
): Promise<number> {
  const { data } = await scoreAdmin.rpc("get_user_credits", { target_user_id: scoreUserId });
  return Number((data as { search_credits?: number })?.search_credits ?? 0);
}

async function ensureScoreCompanyLink(
  scoreAdmin: ReturnType<typeof createClient>,
  scoreUserId: string,
  email: string,
  companyName: string,
  mcNumber: string
): Promise<string | null> {
  const { data: existingLink } = await scoreAdmin
    .from("company_users")
    .select("company_id")
    .eq("user_id", scoreUserId)
    .maybeSingle();

  if (existingLink?.company_id) return existingLink.company_id;

  const { data: regResult } = await scoreAdmin.rpc("register_company", {
    p_company_name: companyName,
    p_mc_number: mcNumber,
    p_company_email: email,
    p_user_id: scoreUserId,
    p_ip_address: "cdl_exchange",
    p_referral_code: null
  });

  const reg = regResult as { success?: boolean; error?: string; company_id?: string } | null;
  if (reg?.success && reg.company_id) return reg.company_id;

  const err = String(reg?.error ?? "").toLowerCase();
  if (err.includes("already") || err.includes("exists")) {
    const { data: existingCompany } = await scoreAdmin
      .from("companies")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    if (existingCompany?.id) {
      await scoreAdmin.from("company_users").upsert(
        { company_id: existingCompany.id, user_id: scoreUserId },
        { onConflict: "user_id" }
      );
      await scoreAdmin.from("user_credits").upsert(
        {
          user_id: scoreUserId,
          company_id: existingCompany.id,
          search_credits: 0,
          updated_at: new Date().toISOString()
        },
        { onConflict: "user_id" }
      );
      return existingCompany.id;
    }
  }

  return reg?.company_id ?? null;
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
      return json({ success: false, error: "CDL Score integration is not configured on the server." }, 503);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ success: false, error: "Unauthorized" }, 401);

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
    if (authErr || !authData.user) return json({ success: false, error: "Unauthorized" }, 401);

    const body = await req.json();
    const syncOnly = Boolean(body.syncCreditsOnly);
    const refreshCreditsOnly = Boolean(body.refreshCreditsOnly);
    const searchCredits = Number(body.searchCredits ?? 0);

    const { data: account } = await exchangeAdmin
      .from("registration_accounts")
      .select("id, email, company_id, account_type, profile_data, selected_plan")
      .eq("auth_user_id", authData.user.id)
      .maybeSingle();

    if (!account?.company_id) return json({ success: false, error: "Exchange account not found" }, 404);

    if (syncOnly || refreshCreditsOnly) {
      let companyId = account.company_id;

      if (body.targetRegistrationId) {
        const { data: caller } = await exchangeAdmin
          .from("registration_accounts")
          .select("is_admin, admin_role")
          .eq("auth_user_id", authData.user.id)
          .maybeSingle();
        const isStaff = Boolean(caller?.is_admin || caller?.admin_role === "manager" || caller?.admin_role === "admin");
        if (!isStaff) return json({ success: false, error: "Forbidden" }, 403);

        const { data: target } = await exchangeAdmin
          .from("registration_accounts")
          .select("company_id")
          .eq("id", String(body.targetRegistrationId))
          .maybeSingle();
        if (!target?.company_id) return json({ success: false, error: "Target account not found" }, 404);
        companyId = target.company_id;
      }

      const { data: company } = await exchangeAdmin
        .from("companies")
        .select("cdl_score_user_id, cdl_score_search_credits")
        .eq("id", companyId)
        .single();

      if (!company?.cdl_score_user_id) {
        return json({ success: false, error: "CDL Score account not linked" }, 400);
      }

      if (syncOnly && searchCredits > 0) {
        await scoreAdmin.rpc("add_user_credits", {
          target_user_id: company.cdl_score_user_id,
          amount: searchCredits
        });
      }

      const liveCredits = await syncScoreCredits(scoreAdmin, company.cdl_score_user_id);
      const nextCredits = syncOnly && searchCredits > 0
        ? Number(company.cdl_score_search_credits ?? 0) + searchCredits
        : liveCredits;

      await exchangeAdmin
        .from("companies")
        .update({ cdl_score_search_credits: nextCredits })
        .eq("id", companyId);

      return json({ success: true, credits: nextCredits });
    }

    const email = String(body.email ?? account.email).trim().toLowerCase();
    const password = String(body.password ?? "");
    const profile = account.profile_data as Record<string, string>;
    const companyName = String(body.companyName ?? profile.companyName ?? profile.agencyName ?? profile.fullName ?? "Carrier");
    const mcNumber = String(body.mcNumber ?? profile.mcNumber ?? "PENDING");
    const contactName = String(body.contactName ?? companyName);

    if (!email || !password) {
      return json({ success: false, error: "Email and password are required" }, 400);
    }

    let scoreUserId: string | null = null;

    const createRes = await scoreAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { source: "cdl_exchange", exchange_account_id: account.id }
    });

    if (createRes.data.user?.id) {
      scoreUserId = createRes.data.user.id;
    } else if (createRes.error?.message?.toLowerCase().includes("already")) {
      scoreUserId = await findScoreUserId(scoreAdmin, email);
    } else if (createRes.error) {
      return json({ success: false, error: createRes.error.message }, 400);
    }

    if (!scoreUserId) return json({ success: false, error: "Could not create CDL Score user" }, 400);

    await scoreAdmin.auth.admin.updateUserById(scoreUserId, {
      password,
      email_confirm: true
    });

    const scoreCompanyId = await ensureScoreCompanyLink(scoreAdmin, scoreUserId, email, companyName, mcNumber);

    if (searchCredits > 0) {
      await scoreAdmin.rpc("add_user_credits", {
        target_user_id: scoreUserId,
        amount: searchCredits
      });
    }

    await scoreAdmin.from("crm_users").upsert(
      {
        user_id: scoreUserId,
        company_id: scoreCompanyId,
        email,
        login_password: password,
        full_name: contactName,
        role: "admin",
        is_active: true
      },
      { onConflict: "user_id" }
    );

    const liveCredits = await syncScoreCredits(scoreAdmin, scoreUserId);

    await exchangeAdmin
      .from("companies")
      .update({
        cdl_score_verified: true,
        cdl_score_email: email,
        cdl_score_user_id: scoreUserId,
        cdl_score_search_credits: liveCredits
      })
      .eq("id", account.company_id);

    return json({ success: true, userId: scoreUserId, credits: liveCredits });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return json({ success: false, error: message }, 500);
  }
});
