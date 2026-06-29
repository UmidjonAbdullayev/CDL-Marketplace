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

async function grantCreditsIfNeeded(
  scoreAdmin: ReturnType<typeof createClient>,
  scoreUserId: string,
  targetCredits: number
): Promise<number> {
  if (targetCredits <= 0) return syncScoreCredits(scoreAdmin, scoreUserId);

  const liveBefore = await syncScoreCredits(scoreAdmin, scoreUserId);
  if (liveBefore < targetCredits) {
    await scoreAdmin.rpc("add_user_credits", {
      target_user_id: scoreUserId,
      amount: targetCredits - liveBefore
    });
  }
  return syncScoreCredits(scoreAdmin, scoreUserId);
}

type ProvisionOpts = {
  email: string;
  password?: string;
  companyName: string;
  mcNumber: string;
  contactName: string;
  exchangeCompanyId: string;
  searchCredits: number;
};

async function provisionAndLinkScoreUser(
  scoreAdmin: ReturnType<typeof createClient>,
  exchangeAdmin: ReturnType<typeof createClient>,
  opts: ProvisionOpts
): Promise<{ scoreUserId: string; credits: number }> {
  const email = opts.email.trim().toLowerCase();
  const password = opts.password?.trim() || `${crypto.randomUUID()}X1!a`;

  let scoreUserId: string | null = null;

  const createRes = await scoreAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { source: "cdl_exchange" }
  });

  if (createRes.data.user?.id) {
    scoreUserId = createRes.data.user.id;
  } else if (createRes.error?.message?.toLowerCase().includes("already")) {
    scoreUserId = await findScoreUserId(scoreAdmin, email);
  } else if (createRes.error) {
    throw new Error(createRes.error.message);
  }

  if (!scoreUserId) throw new Error("Could not create CDL Score user");

  await scoreAdmin.auth.admin.updateUserById(scoreUserId, {
    password,
    email_confirm: true
  });

  const scoreCompanyId = await ensureScoreCompanyLink(
    scoreAdmin,
    scoreUserId,
    email,
    opts.companyName,
    opts.mcNumber
  );

  const credits = await grantCreditsIfNeeded(scoreAdmin, scoreUserId, opts.searchCredits);

  await scoreAdmin.from("crm_users").upsert(
    {
      user_id: scoreUserId,
      company_id: scoreCompanyId,
      email,
      login_password: opts.password?.trim() || null,
      full_name: opts.contactName,
      role: "admin",
      is_active: true
    },
    { onConflict: "user_id" }
  );

  await exchangeAdmin
    .from("companies")
    .update({
      cdl_score_verified: true,
      cdl_score_email: email,
      cdl_score_user_id: scoreUserId,
      cdl_score_search_credits: credits
    })
    .eq("id", opts.exchangeCompanyId);

  return { scoreUserId, credits };
}

function profileFromRegistration(profile: Record<string, string>) {
  return {
    companyName: String(profile.companyName ?? profile.agencyName ?? profile.fullName ?? "Carrier"),
    mcNumber: String(profile.mcNumber ?? "PENDING"),
    contactName: String(profile.contactPersonName ?? profile.companyName ?? profile.fullName ?? "Carrier")
  };
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
    const targetRegistrationId = body.targetRegistrationId
      ? String(body.targetRegistrationId)
      : null;

    const { data: callerAccount } = await exchangeAdmin
      .from("registration_accounts")
      .select("id, email, company_id, account_type, profile_data, selected_plan, is_admin, admin_role, status")
      .eq("auth_user_id", authData.user.id)
      .maybeSingle();

    if (!callerAccount?.company_id && !targetRegistrationId) {
      return json({ success: false, error: "Exchange account not found" }, 404);
    }

    if (syncOnly || refreshCreditsOnly) {
      let companyId = callerAccount?.company_id ?? null;
      let grantCredits = searchCredits;

      if (targetRegistrationId) {
        const isStaff = Boolean(
          callerAccount?.is_admin ||
            callerAccount?.admin_role === "manager" ||
            callerAccount?.admin_role === "admin"
        );
        if (!isStaff) return json({ success: false, error: "Forbidden" }, 403);

        const { data: target } = await exchangeAdmin
          .from("registration_accounts")
          .select("id, email, company_id, account_type, profile_data, selected_plan, status")
          .eq("id", targetRegistrationId)
          .maybeSingle();

        if (!target?.company_id) return json({ success: false, error: "Target account not found" }, 404);
        companyId = target.company_id;

        if (grantCredits <= 0 && target.selected_plan) {
          const planCredits: Record<string, number> = {
            free: 0,
            starter: 5,
            growth: 15,
            pro_fleet: 50
          };
          grantCredits = planCredits[String(target.selected_plan)] ?? 0;
        }

        const { data: company } = await exchangeAdmin
          .from("companies")
          .select("cdl_score_user_id, cdl_score_search_credits")
          .eq("id", companyId)
          .single();

        if (!company?.cdl_score_user_id) {
          const profile = profileFromRegistration((target.profile_data ?? {}) as Record<string, string>);
          const result = await provisionAndLinkScoreUser(scoreAdmin, exchangeAdmin, {
            email: target.email,
            companyName: profile.companyName,
            mcNumber: profile.mcNumber,
            contactName: profile.contactName,
            exchangeCompanyId: companyId,
            searchCredits: grantCredits
          });
          return json({ success: true, credits: result.credits, provisioned: true });
        }

        if (syncOnly && grantCredits > 0) {
          const liveCredits = await grantCreditsIfNeeded(
            scoreAdmin,
            company.cdl_score_user_id,
            grantCredits
          );
          await exchangeAdmin
            .from("companies")
            .update({ cdl_score_search_credits: liveCredits, cdl_score_verified: true })
            .eq("id", companyId);
          return json({ success: true, credits: liveCredits });
        }
      }

      if (!companyId) return json({ success: false, error: "Company not found" }, 404);

      const { data: company } = await exchangeAdmin
        .from("companies")
        .select("cdl_score_user_id, cdl_score_search_credits")
        .eq("id", companyId)
        .single();

      if (!company?.cdl_score_user_id) {
        return json({ success: false, error: "CDL Score account not linked" }, 400);
      }

      if (syncOnly && grantCredits > 0) {
        const liveCredits = await grantCreditsIfNeeded(
          scoreAdmin,
          company.cdl_score_user_id,
          grantCredits
        );
        await exchangeAdmin
          .from("companies")
          .update({ cdl_score_search_credits: liveCredits })
          .eq("id", companyId);
        return json({ success: true, credits: liveCredits });
      }

      const liveCredits = await syncScoreCredits(scoreAdmin, company.cdl_score_user_id);
      await exchangeAdmin
        .from("companies")
        .update({ cdl_score_search_credits: liveCredits })
        .eq("id", companyId);
      return json({ success: true, credits: liveCredits });
    }

    if (!callerAccount?.company_id) {
      return json({ success: false, error: "Exchange account not found" }, 404);
    }

    const email = String(body.email ?? callerAccount.email).trim().toLowerCase();
    const password = String(body.password ?? "");
    const profile = profileFromRegistration((callerAccount.profile_data ?? {}) as Record<string, string>);
    const companyName = String(body.companyName ?? profile.companyName);
    const mcNumber = String(body.mcNumber ?? profile.mcNumber);
    const contactName = String(body.contactName ?? profile.contactName);

    if (!email || !password) {
      return json({ success: false, error: "Email and password are required" }, 400);
    }

    const grantOnProvision =
      searchCredits > 0 ||
      (callerAccount.account_type === "carrier" &&
        callerAccount.status === "active" &&
        searchCredits === 0 &&
        Boolean(body.grantPlanCreditsIfDue));

    let creditsToGrant = searchCredits;
    if (grantOnProvision && creditsToGrant <= 0 && callerAccount.selected_plan) {
      const planCredits: Record<string, number> = {
        free: 0,
        starter: 5,
        growth: 15,
        pro_fleet: 50
      };
      creditsToGrant = planCredits[String(callerAccount.selected_plan)] ?? 0;
    }

    const result = await provisionAndLinkScoreUser(scoreAdmin, exchangeAdmin, {
      email,
      password,
      companyName,
      mcNumber,
      contactName,
      exchangeCompanyId: callerAccount.company_id,
      searchCredits: creditsToGrant
    });

    return json({ success: true, userId: result.scoreUserId, credits: result.credits });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return json({ success: false, error: message }, 500);
  }
});
