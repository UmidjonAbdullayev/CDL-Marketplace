import { getActiveCompanyId } from "../lib/activeCompany";
import { supabase } from "../lib/supabase";

export type NotificationUrgency = "overdue" | "today" | "soon" | "info";

export type AppNotification = {
  id: string;
  type: "deal" | "listing" | "message" | "dispute" | "reservation" | "action" | "payment";
  title: string;
  body: string;
  at: string;
  urgency: NotificationUrgency;
  href: string;
};

export type UpcomingAction = {
  id: string;
  title: string;
  detail: string;
  timeLabel: string;
  urgency: NotificationUrgency;
  href: string;
  initials: string;
  color: string;
};

function urgencyFromDate(iso: string | null): NotificationUrgency {
  if (!iso) return "info";
  const diff = new Date(iso).getTime() - Date.now();
  if (diff < 0) return "overdue";
  if (diff < 86400000) return "today";
  if (diff < 3 * 86400000) return "soon";
  return "info";
}

function parseDueLabel(label: string): NotificationUrgency {
  const lower = label.toLowerCase();
  if (lower.includes("ago") || lower.includes("overdue") || lower.includes("past")) return "overdue";
  if (lower.includes("2h") || lower.includes("hour") || lower.includes("today") || lower.includes("in 2")) return "today";
  if (lower.includes("tomorrow")) return "soon";
  return "info";
}

function urgencyColor(urgency: NotificationUrgency): string {
  if (urgency === "overdue") return "#EF4444";
  if (urgency === "today") return "#F59E0B";
  if (urgency === "soon") return "#3B82F6";
  return "#64748B";
}

export async function fetchUnreadMessageCount(): Promise<number> {
  if (!supabase) return 0;
  const companyId = getActiveCompanyId();
  const { data: convos, error } = await supabase
    .from("conversations")
    .select("id, buyer_company_id, seller_company_id, buyer_last_read_at, seller_last_read_at")
    .or(`buyer_company_id.eq.${companyId},seller_company_id.eq.${companyId}`)
    .in("channel_type", ["carrier_admin", "recruiter_admin"]);
  if (error || !convos?.length) return 0;

  let total = 0;
  for (const c of convos) {
    const since =
      c.buyer_company_id === companyId
        ? c.buyer_last_read_at ?? "1970-01-01T00:00:00Z"
        : c.seller_last_read_at ?? "1970-01-01T00:00:00Z";
    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", c.id)
      .eq("direction", "in")
      .gt("created_at", since);
    total += count ?? 0;
  }
  return total;
}

export async function markConversationRead(conversationId: string): Promise<void> {
  if (!supabase) return;
  const companyId = getActiveCompanyId();
  const { data: conv } = await supabase
    .from("conversations")
    .select("buyer_company_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv) return;
  const field = conv.buyer_company_id === companyId ? "buyer_last_read_at" : "seller_last_read_at";
  await supabase
    .from("conversations")
    .update({ [field]: new Date().toISOString() })
    .eq("id", conversationId);
}

export async function markAllConversationsRead(): Promise<void> {
  if (!supabase) return;
  const companyId = getActiveCompanyId();
  const now = new Date().toISOString();
  const { data: convos } = await supabase
    .from("conversations")
    .select("id, buyer_company_id")
    .or(`buyer_company_id.eq.${companyId},seller_company_id.eq.${companyId}`);
  for (const c of convos ?? []) {
    const field = c.buyer_company_id === companyId ? "buyer_last_read_at" : "seller_last_read_at";
    await supabase.from("conversations").update({ [field]: now }).eq("id", c.id);
  }
}

export async function fetchNotifications(): Promise<AppNotification[]> {
  if (!supabase) return [];
  const items: AppNotification[] = [];
  const now = new Date().toISOString();

  const companyId = getActiveCompanyId();
  const [dealsRes, disputesRes, reservationsRes, listingsRes, followUpsRes, convosRes] = await Promise.all([
    supabase
      .from("deals")
      .select("id, status, updated_at, created_at")
      .or(`buyer_company_id.eq.${companyId},seller_company_id.eq.${companyId}`),
    supabase
      .from("disputes")
      .select("id, deal_id, reason, admin_status, filed_at")
      .eq("filed_by_company_id", companyId)
      .neq("admin_status", "Resolved"),
    supabase.from("reservations").select("id, listing_id, expires_at, created_at").eq("buyer_company_id", companyId),
    supabase
      .from("driver_listings")
      .select("id, first_name, last_name, state, equipment, created_at, hot_score")
      .in("status", ["active", "reserved"])
      .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString())
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("follow_ups").select("*").eq("company_id", companyId),
    supabase
      .from("conversations")
      .select("id, subject, last_message_at, buyer_last_read_at, seller_last_read_at, buyer_company_id")
      .or(`buyer_company_id.eq.${companyId},seller_company_id.eq.${companyId}`)
      .in("channel_type", ["carrier_admin", "recruiter_admin"])
  ]);

  for (const d of dealsRes.data ?? []) {
    if (d.status === "Pending Payment") {
      items.push({
        id: `deal-pay-${d.id}`,
        type: "deal",
        title: `Payment due — Deal ${d.id}`,
        body: "Complete payment to release driver contact details.",
        at: d.updated_at ?? d.created_at ?? now,
        urgency: "today",
        href: "/deals"
      });
    } else if (["Contact Released", "Hired Confirmed"].includes(d.status)) {
      items.push({
        id: `deal-step-${d.id}`,
        type: "deal",
        title: `Action needed — Deal ${d.id}`,
        body: `Deal is at "${d.status}". Advance to the next milestone.`,
        at: d.updated_at ?? d.created_at ?? now,
        urgency: "soon",
        href: "/deals"
      });
    }
  }

  for (const r of reservationsRes.data ?? []) {
    const urgency = urgencyFromDate(r.expires_at);
    if (urgency === "info" && new Date(r.expires_at).getTime() - Date.now() > 5 * 86400000) continue;
    items.push({
      id: `res-${r.id}`,
      type: "reservation",
      title: urgency === "overdue" ? "Reservation expired" : "Reservation expiring soon",
      body: `Listing #${r.listing_id} — ${new Date(r.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      at: r.expires_at,
      urgency,
      href: "/marketplace"
    });
  }

  for (const d of disputesRes.data ?? []) {
    items.push({
      id: `dsp-${d.id}`,
      type: "dispute",
      title: `Open dispute ${d.id}`,
      body: `${d.reason} · Deal ${d.deal_id}`,
      at: d.filed_at,
      urgency: "today",
      href: "/disputes"
    });
  }

  for (const l of listingsRes.data ?? []) {
    const trending = (l.hot_score ?? 0) >= 80;
    items.push({
      id: `list-${l.id}`,
      type: "listing",
      title: trending ? "Trending new listing" : "New listing matches your filters",
      body: `${l.first_name} ${l.last_name.charAt(0)}. · ${l.state} · ${l.equipment}`,
      at: l.created_at ?? now,
      urgency: trending ? "today" : "info",
      href: trending ? "/marketplace?hot=1" : `/driver/${l.id}`
    });
  }

  for (const f of followUpsRes.data ?? []) {
    const urgency = f.due_at ? urgencyFromDate(f.due_at) : parseDueLabel(f.due_label ?? "");
    items.push({
      id: `fu-${f.id}`,
      type: "action",
      title: `Follow up: ${f.driver_name}`,
      body: f.detail ?? "",
      at: f.due_at ?? f.created_at ?? now,
      urgency,
      href: "/ongoing-deals"
    });
  }

  for (const c of convosRes.data ?? []) {
    const since =
      c.buyer_company_id === companyId
        ? c.buyer_last_read_at ?? "1970-01-01T00:00:00Z"
        : (c as { seller_last_read_at?: string | null }).seller_last_read_at ?? "1970-01-01T00:00:00Z";
    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", c.id)
      .eq("direction", "in")
      .gt("created_at", since);
    if ((count ?? 0) > 0) {
      items.push({
        id: `msg-${c.id}`,
        type: "message",
        title: "Unread message",
        body: c.subject || "New reply in your inbox",
        at: c.last_message_at ?? now,
        urgency: "today",
        href: "/messages"
      });
    }
  }

  return items.sort((a, b) => {
    const order: Record<NotificationUrgency, number> = { overdue: 0, today: 1, soon: 2, info: 3 };
    const u = order[a.urgency] - order[b.urgency];
    if (u !== 0) return u;
    return new Date(b.at).getTime() - new Date(a.at).getTime();
  });
}

export async function fetchUpcomingActions(): Promise<UpcomingAction[]> {
  if (!supabase) return [];
  const actions: UpcomingAction[] = [];

  const companyId = getActiveCompanyId();
  const [dealsRes, reservationsRes, followUpsRes, purchasesRes] = await Promise.all([
    supabase
      .from("deals")
      .select("id, status, updated_at, listing_id")
      .or(`buyer_company_id.eq.${companyId},seller_company_id.eq.${companyId}`)
      .in("status", ["Pending Payment", "Contact Released", "Orientation Scheduled", "Hired Confirmed", "Reserved"]),
    supabase.from("reservations").select("listing_id, expires_at").eq("buyer_company_id", companyId),
    supabase.from("follow_ups").select("*").eq("company_id", companyId),
    supabase.from("purchases").select("id, recruit_status, listing_id, purchased_at").eq("buyer_company_id", companyId)
  ]);

  for (const d of dealsRes.data ?? []) {
    const urgency =
      d.status === "Pending Payment" ? "today" : d.status === "Hired Confirmed" ? "soon" : "info";
    actions.push({
      id: `deal-${d.id}`,
      title: `Deal ${d.id}`,
      detail: `${d.status} — advance hiring workflow`,
      timeLabel: d.status === "Pending Payment" ? "Due now" : "In progress",
      urgency,
      href: "/deals",
      initials: "DL",
      color: urgencyColor(urgency)
    });
  }

  for (const r of reservationsRes.data ?? []) {
    const urgency = urgencyFromDate(r.expires_at);
    actions.push({
      id: `res-${r.listing_id}`,
      title: `Reserved lead #${r.listing_id}`,
      detail: urgency === "overdue" ? "Reservation window passed" : "Complete purchase before expiry",
      timeLabel: new Date(r.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      urgency,
      href: `/driver/${r.listing_id}`,
      initials: "RS",
      color: urgencyColor(urgency)
    });
  }

  for (const f of followUpsRes.data ?? []) {
    const urgency = f.due_at ? urgencyFromDate(f.due_at) : parseDueLabel(f.due_label ?? "");
    actions.push({
      id: `fu-${f.id}`,
      title: f.driver_name,
      detail: f.detail ?? "Scheduled follow-up",
      timeLabel: f.due_label ?? "Upcoming",
      urgency,
      href: "/ongoing-deals",
      initials: f.initials ?? "FU",
      color: f.color ?? urgencyColor(urgency)
    });
  }

  for (const p of purchasesRes.data ?? []) {
    if (p.recruit_status === "Hired" || p.recruit_status === "Declined") continue;
    actions.push({
      id: `pur-${p.id}`,
      title: `Purchased lead #${p.listing_id}`,
      detail: `Recruiting: ${p.recruit_status}`,
      timeLabel: "Active",
      urgency: p.recruit_status === "Screening" ? "soon" : "info",
      href: "/ongoing-deals",
      initials: "PL",
      color: "#8B5CF6"
    });
  }

  const order: Record<NotificationUrgency, number> = { overdue: 0, today: 1, soon: 2, info: 3 };
  return actions.sort((a, b) => order[a.urgency] - order[b.urgency]).slice(0, 8);
}

export async function verifyCdlScoreLogin(email: string, password: string): Promise<boolean> {
  if (!supabase) return email === "recruiter@rapidhaul.com" && password === "demo123";
  const { data, error } = await supabase
    .from("cdl_score_users")
    .select("email")
    .eq("email", email.trim().toLowerCase())
    .eq("password", password)
    .maybeSingle();
  if (error || !data) return false;

  await supabase
    .from("companies")
    .update({ cdl_score_verified: true, cdl_score_email: email.trim().toLowerCase() })
    .eq("id", getActiveCompanyId());
  return true;
}

export async function fetchCdlScoreVerified(): Promise<boolean> {
  if (!supabase) return localStorage.getItem("cdl_score_verified") === "1";
  const { data } = await supabase
    .from("companies")
    .select("cdl_score_verified")
    .eq("id", getActiveCompanyId())
    .maybeSingle();
  return Boolean(data?.cdl_score_verified);
}

export const CDL_SCORE_REGISTER_URL = "https://cdlscore.com/register";
