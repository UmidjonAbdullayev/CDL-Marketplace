import {
  Activity,
  Bell,
  CheckCircle2,
  Clock,
  FileText,
  Filter,
  Lock,
  MessageSquare,
  Search,
  User,
  Users
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { MessengerPanel } from "../chat/MessengerPanel";
import { usePlatformRealtime } from "../../hooks/usePlatformRealtime";
import { useApp } from "../../context/AppContext";
import { fmtDate, fmtPrice, fmtRelativeUpdated, fullName } from "../../lib/format";
import { HIRING_STAGES, stageIndex, statusBadgeClass, type HiringStage } from "../../lib/hiring";
import {
  addDealInternalNote,
  advanceHiringStageAsAdmin,
  fetchDealInternalNotes,
  fetchDealMessages,
  fetchDealWorkspace,
  sendDealFileMessage,
  sendDealMessage,
  subscribeDealMessages,
  subscribeDealWorkspace,
  type DealInternalNote,
  type DealMessageRow,
  type DealWorkspace
} from "../../services/hiring";
import {
  assignDealListingAdmin,
  classifyDealBucket,
  fetchPlatformAdmins,
  fetchPlatformDealsDashboard,
  type PlatformAdmin,
  type PlatformOngoingDeal
} from "../../services/platformAdmin";

type DealBucket = "active" | "on_hold" | "completed";
type DetailTab = "overview" | "drivers" | "timeline" | "documents" | "activity";

function formatMsgTime(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 3600000) return `${Math.max(1, Math.floor(diff / 60000))}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function stageLabel(stage: string): string {
  return HIRING_STAGES.find((s) => s.key === stage)?.label ?? stage;
}

function dealProgressPct(deal: PlatformOngoingDeal): number {
  const idx = stageIndex(deal.hiring_stage);
  const signed = deal.buyer_signed_at && deal.seller_signed_at;
  if (!signed) return Math.max(10, idx * 8);
  return Math.round(((idx + 1) / HIRING_STAGES.length) * 100);
}

function dealHealthLabel(deal: PlatformOngoingDeal): { label: string; className: string } {
  const hoursSinceUpdate = (Date.now() - new Date(deal.updated_at).getTime()) / 3600000;
  if (deal.hiring_stage === "completed" || deal.status === "Completed") {
    return { label: "Completed", className: "badge-gray" };
  }
  if (!deal.buyer_signed_at || !deal.seller_signed_at) {
    return { label: "Awaiting signatures", className: "badge-yellow" };
  }
  if (hoursSinceUpdate > 72) return { label: "Needs attention", className: "badge-red" };
  if (hoursSinceUpdate > 24) return { label: "Follow up", className: "badge-yellow" };
  return { label: "Healthy", className: "badge-green" };
}

function stageBadgeClass(stage: string): string {
  if (stage === "orientation") return "badge-purple";
  if (stage === "interview" || stage === "screening") return "badge-blue";
  if (stage === "hired" || stage === "completed") return "badge-green";
  if (stage === "contract") return "badge-yellow";
  return "badge-gray";
}

export function AdminDealsCommandCenter() {
  const location = useLocation();
  const { sessionUser, showToast } = useApp();
  const isManager = sessionUser?.adminRole === "manager";
  const myCompanyId = sessionUser?.companyId ?? "";

  const [deals, setDeals] = useState<PlatformOngoingDeal[]>([]);
  const [admins, setAdmins] = useState<PlatformAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [bucket, setBucket] = useState<DealBucket>("active");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [adminFilter, setAdminFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<DealWorkspace | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [internalNotes, setInternalNotes] = useState<DealInternalNote[]>([]);
  const [noteInput, setNoteInput] = useState("");

  const [chatLane, setChatLane] = useState<"carrier" | "recruiter">("carrier");
  const [messages, setMessages] = useState<DealMessageRow[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedDeal = useMemo(
    () => deals.find((d) => d.id === selectedId) ?? null,
    [deals, selectedId]
  );

  const bucketCounts = useMemo(() => {
    const counts = { active: 0, on_hold: 0, completed: 0 };
    for (const d of deals) counts[classifyDealBucket(d)] += 1;
    return counts;
  }, [deals]);

  const filteredDeals = useMemo(() => {
    let list = deals.filter((d) => classifyDealBucket(d) === bucket);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (d) =>
          d.id.toLowerCase().includes(q) ||
          d.buyer_name.toLowerCase().includes(q) ||
          d.seller_name.toLowerCase().includes(q) ||
          d.driver_full_name.toLowerCase().includes(q)
      );
    }
    if (adminFilter) list = list.filter((d) => d.assigned_admin_id === adminFilter);
    if (statusFilter) {
      list = list.filter((d) => d.status === statusFilter || d.hiring_stage === statusFilter);
    }
    if (dateFrom) list = list.filter((d) => d.updated_at >= dateFrom);
    if (dateTo) list = list.filter((d) => d.updated_at <= `${dateTo}T23:59:59`);
    return list;
  }, [deals, bucket, search, adminFilter, statusFilter, dateFrom, dateTo]);

  const statuses = useMemo(() => [...new Set(deals.map((d) => d.status))], [deals]);

  useEffect(() => {
    const preset = (location.state as { dealId?: string } | null)?.dealId;
    if (preset) setSelectedId(preset);
  }, [location.state]);

  const loadDeals = useCallback(async () => {
    if (!sessionUser?.id) return;
    setLoading(true);
    try {
      const [rows, adminList] = await Promise.all([
        fetchPlatformDealsDashboard(sessionUser.id, sessionUser.adminRole ?? "admin"),
        isManager ? fetchPlatformAdmins() : Promise.resolve([] as PlatformAdmin[])
      ]);
      setDeals(rows);
      setAdmins(adminList);
      setSelectedId((prev) => {
        if (prev && rows.some((r) => r.id === prev)) return prev;
        const firstActive = rows.find((d) => classifyDealBucket(d) === "active") ?? rows[0];
        return firstActive?.id ?? null;
      });
    } catch {
      showToast("Failed to load deals", "error");
    } finally {
      setLoading(false);
    }
  }, [sessionUser?.id, sessionUser?.adminRole, isManager, showToast]);

  useEffect(() => {
    void loadDeals();
  }, [loadDeals]);

  usePlatformRealtime(
    useCallback((topics) => {
      if (topics.has("deals") || topics.has("admin") || topics.has("messages")) {
        void loadDeals();
      }
    }, [loadDeals])
  );

  const loadDetail = useCallback(async (dealId: string) => {
    setDetailLoading(true);
    try {
      const [ws, notes] = await Promise.all([
        fetchDealWorkspace(dealId),
        fetchDealInternalNotes(dealId)
      ]);
      setWorkspace(ws);
      setInternalNotes(notes);
    } catch {
      showToast("Failed to load deal details", "error");
    } finally {
      setDetailLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else {
      setWorkspace(null);
      setInternalNotes([]);
    }
  }, [selectedId, loadDetail]);

  useEffect(() => {
    if (!selectedId) return;
    const listingId = workspace?.deal?.listing_id ?? selectedDeal?.listing_id ?? null;
    const unsub = subscribeDealWorkspace(selectedId, () => void loadDetail(selectedId), listingId);
    return unsub;
  }, [selectedId, loadDetail, workspace?.deal?.listing_id, selectedDeal?.listing_id]);

  const conversationId = chatLane === "carrier"
    ? workspace?.carrierConversationId ?? selectedDeal?.carrier_conversation_id
    : workspace?.recruiterConversationId ?? selectedDeal?.recruiter_conversation_id;

  const channelPartyId = chatLane === "carrier"
    ? workspace?.deal.buyer_company_id
    : workspace?.deal.seller_company_id;

  const pullMessages = useCallback(async () => {
    if (!conversationId) return;
    try {
      setMessages(await fetchDealMessages(conversationId));
    } catch {
      /* background refresh */
    }
  }, [conversationId]);

  useEffect(() => {
    if (conversationId) void pullMessages();
    else setMessages([]);
  }, [conversationId, pullMessages]);

  useEffect(() => {
    if (!conversationId) return;
    const unsub = subscribeDealMessages(conversationId, () => void pullMessages());
    return unsub;
  }, [conversationId, pullMessages]);

  const sendChat = async () => {
    if (!chatInput.trim() || !conversationId || !channelPartyId || !myCompanyId || chatSending) return;
    const text = chatInput.trim();
    setChatInput("");
    setChatSending(true);
    try {
      await sendDealMessage(conversationId, text, myCompanyId, channelPartyId);
      await pullMessages();
    } catch {
      showToast("Failed to send message", "error");
    } finally {
      setChatSending(false);
    }
  };

  const shareFile = async (file: File) => {
    if (!conversationId || !channelPartyId || !myCompanyId || chatSending) return;
    setChatSending(true);
    try {
      await sendDealFileMessage(conversationId, file, myCompanyId, channelPartyId);
      await pullMessages();
    } catch {
      showToast("Failed to send file", "error");
    } finally {
      setChatSending(false);
    }
  };

  const advanceStage = async (stage: HiringStage) => {
    if (!selectedId) return;
    try {
      await advanceHiringStageAsAdmin(selectedId, stage);
      showToast(`Stage updated: ${stageLabel(stage)}`, "success");
      await Promise.all([loadDeals(), loadDetail(selectedId)]);
    } catch {
      showToast("Failed to update stage", "error");
    }
  };

  const saveNote = async () => {
    if (!selectedId || !noteInput.trim()) return;
    try {
      await addDealInternalNote(selectedId, sessionUser?.name ?? "Admin", noteInput.trim());
      setNoteInput("");
      setInternalNotes(await fetchDealInternalNotes(selectedId));
      showToast("Internal note saved", "success");
    } catch {
      showToast("Failed to save note", "error");
    }
  };

  const assignAdmin = async (adminId: string) => {
    if (!selectedDeal?.listing_id) return;
    try {
      await assignDealListingAdmin(selectedDeal.listing_id, adminId || null);
      showToast("Case reassigned", "success");
      await loadDeals();
    } catch {
      showToast("Failed to reassign", "error");
    }
  };

  const driver = workspace?.driver;
  const deal = workspace?.deal;
  const currentStageIdx = stageIndex(deal?.hiring_stage ?? selectedDeal?.hiring_stage ?? "contract");
  const chatOpen = Boolean(
    chatLane === "carrier"
      ? deal?.buyer_signed_at && conversationId
      : deal?.seller_signed_at && conversationId
  );
  const progress = selectedDeal ? dealProgressPct(selectedDeal) : 0;
  const health = selectedDeal ? dealHealthLabel(selectedDeal) : null;

  const detailTabs: { id: DetailTab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "drivers", label: "Drivers", count: driver ? 1 : 0 },
    { id: "timeline", label: "Timeline" },
    { id: "documents", label: "Documents", count: workspace?.documents.length },
    { id: "activity", label: "Activity", count: workspace?.events.length }
  ];

  return (
    <div className="admin-deals-command">
      <aside className="admin-deals-sidebar">
        <div className="admin-deals-sidebar-head">
          <div className="admin-deals-sidebar-title">
            <Bell className="icon-sm" />
            <span>Deals Available</span>
            <span className="admin-deals-count">{deals.length}</span>
          </div>
          {isManager ? (
            <button
              type="button"
              className={`admin-deals-filter-btn ${showFilters ? "active" : ""}`}
              title="Filters"
              onClick={() => setShowFilters((v) => !v)}
            >
              <Filter className="icon-sm" />
            </button>
          ) : null}
        </div>

        <div className="admin-deals-buckets">
          {(["active", "on_hold", "completed"] as DealBucket[]).map((b) => (
            <button
              key={b}
              type="button"
              className={`admin-deals-bucket ${bucket === b ? "active" : ""}`}
              onClick={() => setBucket(b)}
            >
              {b === "active" ? "Active" : b === "on_hold" ? "On Hold" : "Completed"} ({bucketCounts[b]})
            </button>
          ))}
        </div>

        <div className="admin-deals-search">
          <Search className="icon-sm" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search deals..."
          />
        </div>

        {isManager && showFilters ? (
          <div className="admin-deals-filters">
            <select value={adminFilter} onChange={(e) => setAdminFilter(e.target.value)}>
              <option value="">All admins</option>
              {admins.filter((a) => a.admin_role === "admin").map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        ) : null}

        <div className="admin-deals-list scroll-y">
          {loading ? (
            <p className="admin-deals-empty t-secondary">Loading deals…</p>
          ) : filteredDeals.length === 0 ? (
            <p className="admin-deals-empty t-secondary">No deals in this view</p>
          ) : (
            filteredDeals.map((d) => {
              const pct = dealProgressPct(d);
              return (
                <button
                  key={d.id}
                  type="button"
                  className={`admin-deal-card ${selectedId === d.id ? "selected" : ""}`}
                  onClick={() => setSelectedId(d.id)}
                >
                  <div className="admin-deal-card-top">
                    <span className="admin-deal-id">#{d.id.replace(/^DL-/, "")}</span>
                    <span className={`badge ${stageBadgeClass(d.hiring_stage)}`}>{stageLabel(d.hiring_stage)}</span>
                  </div>
                  <strong className="admin-deal-carrier">{d.buyer_name}</strong>
                  <p className="admin-deal-meta">{d.driver_full_name} · {d.driver_type}</p>
                  <p className="admin-deal-price">{fmtPrice(d.carrier_price)} per hire</p>
                  <div className="admin-deal-progress">
                    <div className="admin-deal-progress-bar">
                      <span style={{ width: `${pct}%` }} />
                    </div>
                    <span className="t-caption">{pct}%</span>
                  </div>
                  <span className="admin-deal-updated t-caption">{fmtRelativeUpdated(d.updated_at)}</span>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <section className="admin-deals-main">
        {!selectedDeal ? (
          <div className="admin-deals-placeholder">
            <Users className="icon-xl" />
            <h3>Select a deal</h3>
            <p className="t-secondary">Choose a case from the left to manage hiring progress and coordinate both parties.</p>
          </div>
        ) : detailLoading && !workspace ? (
          <div className="admin-deals-placeholder"><p className="t-secondary">Loading deal workspace…</p></div>
        ) : (
          <>
            <header className="admin-deal-header">
              <div>
                <h2>Deal {selectedDeal.id}</h2>
                <span className={`badge ${statusBadgeClass(selectedDeal.status)}`}>{selectedDeal.status}</span>
              </div>
            </header>

            <div className="admin-deal-meta-grid">
              <div><span className="lbl">Carrier</span><strong>{selectedDeal.buyer_name}</strong></div>
              <div><span className="lbl">Recruiter</span><strong>{selectedDeal.seller_name}</strong></div>
              <div><span className="lbl">Position</span><strong>{selectedDeal.driver_full_name} — {selectedDeal.driver_type}</strong></div>
              <div><span className="lbl">Deal Value</span><strong>{fmtPrice(selectedDeal.carrier_price)} per hire</strong></div>
              <div><span className="lbl">List / Carrier</span><strong>{selectedDeal.list_price != null ? fmtPrice(selectedDeal.list_price) : "—"} / {fmtPrice(selectedDeal.carrier_price)}</strong></div>
              <div><span className="lbl">Date Created</span><strong>{fmtDate(selectedDeal.created_at)}</strong></div>
              {isManager ? (
                <div className="admin-deal-assign">
                  <span className="lbl">Assigned admin</span>
                  <select
                    value={selectedDeal.assigned_admin_id ?? ""}
                    onChange={(e) => void assignAdmin(e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {admins.filter((a) => a.admin_role === "admin").map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div><span className="lbl">Assigned admin</span><strong>{selectedDeal.assigned_admin_name}</strong></div>
              )}
            </div>

            <div className="admin-deal-tabs">
              {detailTabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`admin-deal-tab ${detailTab === t.id ? "active" : ""}`}
                  onClick={() => setDetailTab(t.id)}
                >
                  {t.label}{t.count != null && t.count > 0 ? ` (${t.count})` : ""}
                </button>
              ))}
            </div>

            <div className="admin-deal-content scroll-y">
              {detailTab === "overview" || detailTab === "timeline" ? (
                <div className="card admin-deal-progress-card">
                  <div className="card-header"><h3>Deal Progress</h3></div>
                  <div className="card-body">
                    <div className="admin-progress-stepper">
                      {HIRING_STAGES.map((stage, i) => {
                        const done = i <= currentStageIdx;
                        const current = i === currentStageIdx;
                        const event = workspace?.events.find((e) => e.stage === stage.key);
                        return (
                          <div key={stage.key} className={`admin-progress-step ${done ? "done" : ""} ${current ? "current" : ""}`}>
                            <div className="admin-progress-dot">{done ? <CheckCircle2 className="icon-sm" /> : i + 1}</div>
                            <strong>{stage.label}</strong>
                            {event ? <span className="t-caption">{fmtDate(event.created_at)}</span> : null}
                          </div>
                        );
                      })}
                    </div>
                    {detailTab === "timeline" && chatOpen ? (
                      <div className="admin-stage-actions">
                        {(["screening", "interview", "orientation", "hired", "completed"] as HiringStage[]).map((s) => (
                          <button key={s} type="button" className="btn btn-ghost btn-sm" onClick={() => void advanceStage(s)}>
                            → {stageLabel(s)}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {detailTab === "overview" && driver ? (
                <>
                  <div className="card">
                    <div className="card-header"><h3>Deal Summary</h3></div>
                    <div className="card-body admin-summary-grid">
                      <div><span className="lbl">Equipment Type</span><strong>{driver.equip}</strong></div>
                      <div><span className="lbl">Experience</span><strong>{driver.expLabel}</strong></div>
                      <div><span className="lbl">Driver Location</span><strong>{driver.state}</strong></div>
                      <div><span className="lbl">CDL Class</span><strong>{driver.cdl}</strong></div>
                      <div><span className="lbl">Recruiter list price</span><strong>{selectedDeal.list_price != null ? fmtPrice(selectedDeal.list_price) : "—"}</strong></div>
                      <div><span className="lbl">Carrier fee</span><strong>{fmtPrice(selectedDeal.carrier_price)}</strong></div>
                    </div>
                  </div>
                  <div className="card">
                    <div className="card-header"><h3>Recent Activity</h3></div>
                    <div className="card-body admin-activity-feed">
                      {(workspace?.events ?? []).filter((e) => e.stage !== "admin_note").slice(-5).reverse().map((e) => (
                        <div key={e.id} className="admin-activity-item">
                          <Activity className="icon-sm" />
                          <div>
                            <strong>{e.title}</strong>
                            {e.description ? <p className="t-secondary">{e.description}</p> : null}
                            <span className="t-caption">{fmtDate(e.created_at)}</span>
                          </div>
                        </div>
                      ))}
                      {!workspace?.events.length ? <p className="t-secondary">No activity yet</p> : null}
                    </div>
                  </div>
                </>
              ) : null}

              {detailTab === "drivers" && driver ? (
                <div className="card">
                  <div className="card-header"><h3>Drivers</h3></div>
                  <div className="card-body">
                    <div className="admin-driver-row">
                      <div className="admin-driver-avatar">{driver.first[0]}{driver.last[0]}</div>
                      <div>
                        <strong>{fullName(driver)}</strong>
                        <p className="t-secondary">{driver.cdl} · {driver.expLabel} · {driver.state}</p>
                      </div>
                      <span className={`badge ${stageBadgeClass(selectedDeal.hiring_stage)}`}>{stageLabel(selectedDeal.hiring_stage)}</span>
                    </div>
                  </div>
                </div>
              ) : null}

              {detailTab === "documents" ? (
                <div className="card">
                  <div className="card-header"><h3>Documents</h3></div>
                  <div className="card-body">
                    {!workspace?.documents.length ? (
                      <p className="t-secondary">No documents shared yet.</p>
                    ) : (
                      <ul className="deal-doc-list">
                        {workspace.documents.map((d) => (
                          <li key={d.id}>
                            <FileText className="icon-sm" />
                            {d.download_url ? (
                              <a href={d.download_url} target="_blank" rel="noopener noreferrer">{d.file_name}</a>
                            ) : (
                              <span>{d.file_name}</span>
                            )}
                            <span className="t-caption t-secondary">{fmtDate(d.created_at)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ) : null}

              {detailTab === "activity" ? (
                <div className="card">
                  <div className="card-header"><h3>Activity Log</h3></div>
                  <div className="card-body admin-activity-feed">
                    {(workspace?.events ?? []).filter((e) => e.stage !== "admin_note").slice().reverse().map((e) => (
                      <div key={e.id} className="admin-activity-item">
                        <Clock className="icon-sm" />
                        <div>
                          <strong>{e.title}</strong>
                          {e.description ? <p className="t-secondary">{e.description}</p> : null}
                          <span className="t-caption">{fmtDate(e.created_at)}</span>
                        </div>
                      </div>
                    ))}
                    {!workspace?.events.length ? <p className="t-secondary">No activity yet</p> : null}
                  </div>
                </div>
              ) : null}
            </div>
          </>
        )}
      </section>

      <aside className="admin-deals-rail">
        {selectedDeal && health ? (
          <>
            <div className="card admin-health-card">
              <div className="card-header row">
                <h3>Deal Health</h3>
                <span className={`badge ${health.className}`}>{health.label}</span>
              </div>
              <div className="card-body">
                <div className="admin-deal-progress">
                  <div className="admin-deal-progress-bar admin-deal-progress-bar--lg">
                    <span style={{ width: `${progress}%` }} />
                  </div>
                  <span className="t-caption">{progress}% complete</span>
                </div>
              </div>
            </div>

            <div className="card admin-chat-card">
              <div className="card-header">
                <h3><MessageSquare className="icon-sm" /> Deal Communication</h3>
              </div>
              <div className="admin-chat-lanes">
                <button
                  type="button"
                  className={`admin-chat-lane ${chatLane === "carrier" ? "active" : ""}`}
                  onClick={() => setChatLane("carrier")}
                >
                  Carrier Chat
                </button>
                <button
                  type="button"
                  className={`admin-chat-lane ${chatLane === "recruiter" ? "active" : ""}`}
                  onClick={() => setChatLane("recruiter")}
                >
                  Recruiter Chat
                </button>
              </div>
              {chatOpen ? (
                <MessengerPanel
                  className="messenger-panel--admin-rail"
                  title={chatLane === "carrier" ? selectedDeal.buyer_name : selectedDeal.seller_name}
                  live
                  messages={messages.map((m) => ({
                    id: m.id,
                    body: m.body,
                    isMine: Boolean(m.sender_company_id && m.sender_company_id === myCompanyId),
                    isSystem: !m.sender_company_id,
                    attachmentName: m.attachment_name,
                    attachmentPath: m.attachment_path,
                    attachmentUrl: m.attachment_url,
                    timeLabel: formatMsgTime(m.created_at)
                  }))}
                  emptyMessage={`Message ${chatLane === "carrier" ? "the carrier" : "the recruiter"} on behalf of the platform.`}
                  value={chatInput}
                  onChange={setChatInput}
                  onSend={() => void sendChat()}
                  sending={chatSending}
                  onFileSelect={(file) => void shareFile(file)}
                  messagesEndRef={messagesEndRef}
                  focusKey={`${selectedId}-${chatLane}`}
                />
              ) : (
                <div className="admin-chat-locked">
                  <Lock className="icon-sm" />
                  <p className="t-secondary">
                    {chatLane === "carrier"
                      ? "Carrier chat opens after the buyer signs the agreement."
                      : "Recruiter chat opens after both parties sign."}
                  </p>
                </div>
              )}
            </div>

            <div className="card admin-notes-card">
              <div className="card-header">
                <h3><Lock className="icon-sm" /> Internal Deal Notes</h3>
              </div>
              <div className="card-body">
                <div className="admin-notes-list scroll-y">
                  {internalNotes.map((n) => (
                    <div key={n.id} className="admin-note-item">
                      <strong>{n.author_name}</strong>
                      <p>{n.body}</p>
                      <span className="t-caption">{fmtDate(n.created_at)}</span>
                    </div>
                  ))}
                  {!internalNotes.length ? <p className="t-secondary">No internal notes yet.</p> : null}
                </div>
                <textarea
                  className="admin-note-input"
                  rows={3}
                  placeholder="Add an internal note (not visible to carrier or recruiter)…"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                />
                <button type="button" className="btn btn-primary btn-sm" disabled={!noteInput.trim()} onClick={() => void saveNote()}>
                  Save note
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="admin-deals-rail-empty">
            <User className="icon-lg" />
            <p className="t-secondary">Deal health, dual chat, and internal notes appear here.</p>
          </div>
        )}
      </aside>
    </div>
  );
}
