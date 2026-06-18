import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  MessageSquare,
  User
} from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { MessengerPanel } from "../components/chat/MessengerPanel";
import { useApp } from "../context/AppContext";
import { isPlatformStaff } from "../lib/account-capabilities";
import { ScoreBadge, VerifiedBadge } from "../lib/badges";
import {
  BUYER_CONTRACT_CLAUSES,
  HIRING_STAGES,
  SELLER_CONTRACT_CLAUSES,
  stageIndex,
  statusBadgeClass
} from "../lib/hiring";
import { fmtDate, fmtRecruitingFee, fullName } from "../lib/format";
import { isSupabaseConfigured } from "../lib/supabase";
import {
  advanceHiringStageAsAdmin,
  fetchDealMessages,
  fetchDealWorkspace,
  isOwnDealMessage,
  sendDealFileMessage,
  sendDealMessage,
  signSellerContract,
  subscribeDealMessages,
  uploadDealDocument,
  recordDealDocument,
  type DealMessageRow,
  type DealWorkspace
} from "../services/hiring";
import type { HiringStage } from "../lib/hiring";

type Tab = "overview" | "timeline" | "chat" | "documents";

function formatMsgTime(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 3600000) return `${Math.max(1, Math.floor(diff / 60000))}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function DealWorkspacePage() {
  const { dealId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast, sessionUser } = useApp();

  const [workspace, setWorkspace] = useState<DealWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [messages, setMessages] = useState<DealMessageRow[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [adminChatLane, setAdminChatLane] = useState<"carrier" | "recruiter">(
    searchParams.get("chat") === "recruiter" ? "recruiter" : "carrier"
  );
  const [sellerName, setSellerName] = useState(sessionUser?.name ?? "");
  const [sellerAgreed, setSellerAgreed] = useState(false);
  const [signing, setSigning] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const docFileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = isPlatformStaff(sessionUser);
  const myCompanyId = sessionUser?.companyId ?? "";
  const deal = workspace?.deal;
  const driver = workspace?.driver;
  const isBuyerParty = deal?.buyer_company_id === myCompanyId;
  const isSellerParty = deal?.seller_company_id === myCompanyId;
  const isCarrierParty = isBuyerParty && !isAdmin;
  const isRecruiterParty = isSellerParty && !isAdmin;

  const carrierChatOpen = Boolean(deal?.buyer_signed_at && workspace?.carrierConversationId);
  const recruiterChatOpen = Boolean(deal?.seller_signed_at && workspace?.recruiterConversationId);
  const chatOpen = isAdmin
    ? carrierChatOpen || recruiterChatOpen
    : isCarrierParty
      ? carrierChatOpen
      : isRecruiterParty
        ? recruiterChatOpen
        : false;

  const channelPartyId = isAdmin
    ? adminChatLane === "carrier"
      ? deal?.buyer_company_id
      : deal?.seller_company_id
    : isCarrierParty
      ? deal?.buyer_company_id
      : deal?.seller_company_id;

  const conversationId = isAdmin
    ? adminChatLane === "carrier"
      ? workspace?.carrierConversationId
      : workspace?.recruiterConversationId
    : isCarrierParty
      ? workspace?.carrierConversationId
      : workspace?.recruiterConversationId ?? null;

  const currentStageIdx = stageIndex(deal?.hiring_stage ?? "contract");
  const needsSellerSign = Boolean(deal && !deal.seller_signed_at && deal.buyer_signed_at);

  const load = useCallback(async () => {
    if (!dealId) return;
    try {
      if (isSupabaseConfigured) {
        const ws = await fetchDealWorkspace(dealId);
        setWorkspace(ws);
      }
    } catch {
      showToast("Failed to load deal", "error");
    } finally {
      setLoading(false);
    }
  }, [dealId, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const pullMessages = useCallback(async () => {
    if (!conversationId) return;
    try {
      const fresh = await fetchDealMessages(conversationId);
      setMessages(fresh);
    } catch {
      /* background refresh */
    }
  }, [conversationId]);

  useEffect(() => {
    if (conversationId) void pullMessages();
  }, [conversationId, pullMessages]);

  useEffect(() => {
    if (tab !== "chat" || !chatOpen || !conversationId) return;

    void pullMessages();
    const interval = window.setInterval(() => void pullMessages(), 3000);
    const unsub = subscribeDealMessages(conversationId, () => void pullMessages());

    return () => {
      window.clearInterval(interval);
      unsub();
    };
  }, [tab, chatOpen, conversationId, pullMessages]);

  const mergeMessage = (saved: DealMessageRow, tempId: string) => {
    setMessages((prev) => {
      const withoutTemp = prev.filter((m) => m.id !== tempId);
      if (withoutTemp.some((m) => m.id === saved.id)) return withoutTemp;
      return [...withoutTemp, saved];
    });
  };

  const sendChat = async () => {
    if (!chatInput.trim() || !conversationId || !deal || !myCompanyId || chatSending || !channelPartyId) return;
    const text = chatInput.trim();
    setChatInput("");
    const tempId = `temp-${Date.now()}`;
    const optimistic: DealMessageRow = {
      id: tempId,
      direction: myCompanyId === channelPartyId ? "out" : "in",
      body: text,
      created_at: new Date().toISOString(),
      attachment_name: null,
      attachment_path: null,
      attachment_url: null,
      sender_company_id: myCompanyId
    };
    setMessages((prev) => [...prev, optimistic]);
    setChatSending(true);
    try {
      const saved = await sendDealMessage(conversationId, text, myCompanyId, channelPartyId);
      if (saved) mergeMessage(saved, tempId);
      else void pullMessages();
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      showToast("Failed to send message", "error");
    } finally {
      setChatSending(false);
    }
  };

  const shareFile = async (file: File) => {
    if (!conversationId || !deal || !myCompanyId || chatSending || !channelPartyId) return;
    const label = file.name;
    const body = `Shared file: ${label}`;
    const tempId = `temp-${Date.now()}`;
    const optimistic: DealMessageRow = {
      id: tempId,
      direction: myCompanyId === channelPartyId ? "out" : "in",
      body,
      created_at: new Date().toISOString(),
      attachment_name: label,
      attachment_path: null,
      attachment_url: null,
      sender_company_id: myCompanyId
    };
    setMessages((prev) => [...prev, optimistic]);
    setChatSending(true);
    try {
      const saved = await sendDealFileMessage(conversationId, file, myCompanyId, channelPartyId);
      if (saved?.attachment_path && saved.attachment_name) {
        await recordDealDocument(deal.id, saved.attachment_name, saved.attachment_path, myCompanyId);
      }
      if (saved) mergeMessage(saved, tempId);
      else void pullMessages();
      await load();
      showToast(`Shared: ${label}`, "success");
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      showToast("Failed to share file", "error");
    } finally {
      setChatSending(false);
    }
  };

  const attachDoc = async (file: File) => {
    if (!deal || !myCompanyId) return;
    await uploadDealDocument(deal.id, file, myCompanyId);
    showToast(`Shared: ${file.name}`, "success");
    await load();
    setTab("documents");
  };

  const sellerSign = async () => {
    if (!deal || !sellerAgreed || !sellerName.trim()) return;
    setSigning(true);
    try {
      await signSellerContract(deal.id, sellerName.trim());
      showToast("Seller agreement signed. Platform chat channels are open.", "success");
      await load();
      setTab("chat");
    } catch {
      showToast("Failed to sign agreement", "error");
    } finally {
      setSigning(false);
    }
  };

  const advanceStage = async (stage: HiringStage) => {
    if (!deal || !isAdmin) return;
    try {
      await advanceHiringStageAsAdmin(deal.id, stage);
      showToast(`Stage updated: ${stage}`, "success");
      await load();
    } catch {
      showToast("Failed to update hiring stage", "error");
    }
  };

  const priceSidebar = useMemo(() => {
    const listPrice = workspace?.listPrice ?? null;
    const carrierPrice = workspace?.carrierPrice ?? deal?.amount ?? 0;
    if (isAdmin) {
      return {
        label: "Pricing (internal)",
        value: `${listPrice != null ? fmtRecruitingFee(listPrice) : "—"} list · ${fmtRecruitingFee(carrierPrice)} carrier`
      };
    }
    if (isCarrierParty) {
      return { label: "Platform recruiting fee", value: fmtRecruitingFee(carrierPrice) };
    }
    return { label: "Your listing price", value: listPrice != null ? fmtRecruitingFee(listPrice) : "—" };
  }, [workspace, deal, isAdmin, isCarrierParty]);

  const tabs = useMemo(
    () => [
      { id: "overview" as Tab, label: "Profile", icon: User },
      { id: "timeline" as Tab, label: "Timeline", icon: Clock },
      { id: "chat" as Tab, label: "Platform Chat", icon: MessageSquare, disabled: !chatOpen },
      { id: "documents" as Tab, label: "Contracts", icon: FileText, disabled: !deal?.buyer_signed_at }
    ],
    [chatOpen, deal?.buyer_signed_at]
  );

  if (loading) {
    return <div className="page active"><p className="t-secondary">Loading deal workspace...</p></div>;
  }

  if (!deal || !driver) {
    return (
      <div className="page active">
        <p className="t-secondary">Deal not found.</p>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate("/ongoing-deals")}>
          Back to Ongoing Deals
        </button>
      </div>
    );
  }

  return (
    <div className={`page active deal-workspace-page ${tab === "chat" && chatOpen ? "deal-workspace-page--chat-active" : ""}`}>
      <div className="page-header inline">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate("/ongoing-deals")}>
          <ArrowLeft className="icon-sm" /> Ongoing Deals
        </button>
        <div>
          <h2>{fullName(driver)}</h2>
          <p className="t-secondary">
            {deal.id} · {isAdmin
              ? `${deal.companies_buyer?.name} ↔ ${deal.companies_seller?.name} (platform mediated)`
              : "Coordinated by CDL Exchange platform team"}
          </p>
        </div>
        <span className={`badge ${statusBadgeClass(deal.status)}`} style={{ marginLeft: "auto" }}>{deal.status}</span>
      </div>

      {needsSellerSign && isSellerParty ? (
        <div className="card seller-contract-banner">
          <div className="card-body">
            <h3>Seller representation agreement required</h3>
            <p className="t-secondary" style={{ marginBottom: 12 }}>
              Buyer signed on {deal.buyer_signed_at ? fmtDate(deal.buyer_signed_at) : "—"} by {deal.buyer_signer_name}.
              Seller must countersign before messaging and document sharing open.
            </p>
            <ul className="contract-clauses-compact">
              {SELLER_CONTRACT_CLAUSES.map((c) => <li key={c}>{c}</li>)}
            </ul>
            <div className="seller-sign-row">
              <input
                value={sellerName}
                onChange={(e) => setSellerName(e.target.value)}
                placeholder="Seller authorized signer"
                style={{ flex: 1 }}
              />
              <label className="filter-check">
                <input type="checkbox" checked={sellerAgreed} onChange={(e) => setSellerAgreed(e.target.checked)} />
                I accept seller responsibilities
              </label>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!sellerAgreed || !sellerName.trim() || signing}
                onClick={() => void sellerSign()}
              >
                {signing ? "Signing..." : "Sign as Seller"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="deal-workspace-tabs">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              className={`deal-tab ${tab === t.id ? "active" : ""} ${t.disabled ? "disabled" : ""}`}
              disabled={t.disabled}
              onClick={() => setTab(t.id)}
            >
              <Icon className="icon-sm" /> {t.label}
            </button>
          );
        })}
      </div>

      <div className={`deal-workspace-body ${tab === "chat" && chatOpen ? "deal-workspace-body--chat" : ""}`}>
      {tab === "overview" ? (
        <div className="detail-layout revealed">
          <div className="detail-main card">
            <div className="card-body">
              <div style={{ display: "flex", gap: "var(--s3)", flexWrap: "wrap", alignItems: "center" }}>
                <ScoreBadge score={driver.score} />
                {driver.verified ? <VerifiedBadge text="Verified Listing" /> : null}
              </div>
              <div className="info-grid">
                <div className="info-item"><div className="lbl">Full Name</div><div className="val">{fullName(driver)}</div></div>
                <div className="info-item"><div className="lbl">Phone</div><div className="val">{driver.phone}</div></div>
                <div className="info-item"><div className="lbl">Email</div><div className="val">{driver.email}</div></div>
                <div className="info-item"><div className="lbl">Experience</div><div className="val">{driver.exp} years</div></div>
                <div className="info-item"><div className="lbl">State</div><div className="val">{driver.state}</div></div>
                <div className="info-item"><div className="lbl">CDL Class</div><div className="val">{driver.cdl}</div></div>
                <div className="info-item"><div className="lbl">Equipment</div><div className="val">{driver.equip}</div></div>
                <div className="info-item"><div className="lbl">Availability</div><div className="val">{fmtDate(driver.avail)}</div></div>
              </div>
              {chatOpen ? (
                <div style={{ marginTop: "var(--s5)" }}>
                  <h4 className="t-card" style={{ marginBottom: "var(--s3)" }}>Listing Documents</h4>
                  <ul className="t-secondary" style={{ paddingLeft: "var(--s5)" }}>{driver.docs.map((doc) => <li key={doc}>{doc}</li>)}</ul>
                  {driver.notes ? (
                    <>
                      <h4 className="t-card" style={{ margin: "var(--s4) 0 var(--s3)" }}>Seller Notes</h4>
                      <p className="t-secondary" style={{ background: "var(--bg)", padding: "var(--s4)", borderRadius: "var(--radius-btn)", border: "1px solid var(--border)" }}>{driver.notes}</p>
                    </>
                  ) : null}
                </div>
              ) : (
                <p className="t-secondary" style={{ marginTop: 16 }}>
                  Full contact details and documents unlock after both parties sign the recruiting agreement.
                </p>
              )}
            </div>
          </div>
          <div className="detail-sidebar">
            <div className="card">
              <div className="card-body">
                <div className="lbl" style={{ fontSize: 11, color: "var(--gray-500)", textTransform: "uppercase" }}>{priceSidebar.label}</div>
                <div className="detail-price">{priceSidebar.value}</div>
                {isAdmin ? (
                  <p className="t-caption t-secondary" style={{ marginTop: 8 }}>Recruiters see list price only. Carriers see final approved fee only.</p>
                ) : (
                  <p className="t-caption t-secondary" style={{ marginTop: 8 }}>All updates are coordinated through platform admins.</p>
                )}
                <div className="contract-sign-status" style={{ marginTop: 12, fontSize: 13 }}>
                  <div>{deal.buyer_signed_at ? <CheckCircle2 className="icon-sm" style={{ color: "var(--success)" }} /> : <Clock className="icon-sm" />} Buyer signed</div>
                  <div>{deal.seller_signed_at ? <CheckCircle2 className="icon-sm" style={{ color: "var(--success)" }} /> : <Clock className="icon-sm" />} Seller signed</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "timeline" ? (
        <div className="card">
          <div className="card-header" style={{ justifyContent: "space-between" }}>
            <h3>Hiring Timeline</h3>
            {chatOpen && isAdmin ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(["screening", "interview", "orientation", "hired", "completed"] as HiringStage[]).map((s) => (
                  <button key={s} type="button" className="btn btn-ghost btn-sm" onClick={() => void advanceStage(s)}>
                    → {s}
                  </button>
                ))}
              </div>
            ) : chatOpen ? (
              <span className="t-caption t-secondary">Timeline updates are managed by platform admins</span>
            ) : null}
          </div>
          <div className="card-body">
            <div className="timeline deal-timeline">
              {HIRING_STAGES.map((stage, i) => {
                const done = i <= currentStageIdx && chatOpen;
                const current = i === currentStageIdx && chatOpen;
                return (
                  <div key={stage.key} className={`timeline-item ${done ? "done" : ""} ${current ? "current" : ""}`}>
                    <strong>{stage.label}</strong><br />
                    <span className="t-secondary">{stage.desc}</span>
                  </div>
                );
              })}
            </div>
            {workspace.events.length > 0 ? (
              <div className="deal-events-log">
                <h4 style={{ margin: "20px 0 10px" }}>Activity Log</h4>
                {workspace.events.map((e) => (
                  <div key={e.id} className="deal-event-row">
                    <span className="t-caption t-secondary">{fmtDate(e.created_at)}</span>
                    <strong>{e.title}</strong>
                    {e.description ? <span className="t-secondary"> — {e.description}</span> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === "chat" && chatOpen ? (
        <>
          {isAdmin ? (
            <div className="admin-chat-lanes" style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button type="button" className={`btn btn-sm ${adminChatLane === "carrier" ? "btn-primary" : "btn-secondary"}`} onClick={() => setAdminChatLane("carrier")}>Carrier channel</button>
              <button type="button" className={`btn btn-sm ${adminChatLane === "recruiter" ? "btn-primary" : "btn-secondary"}`} onClick={() => setAdminChatLane("recruiter")}>Recruiter channel</button>
            </div>
          ) : null}
        <MessengerPanel
          className="messenger-panel--docked"
          title={isAdmin
            ? adminChatLane === "carrier"
              ? `Carrier channel — ${deal.companies_buyer?.name ?? "Carrier"}`
              : `Recruiter channel — ${deal.companies_seller?.name ?? "Recruiter"}`
            : "Platform coordinator"}
          live
          messages={messages.map((m) => ({
            id: m.id,
            body: m.body,
            isMine: isOwnDealMessage(m, myCompanyId, channelPartyId ?? ""),
            isSystem: !m.sender_company_id,
            attachmentName: m.attachment_name,
            attachmentPath: m.attachment_path,
            attachmentUrl: m.attachment_url,
            timeLabel: formatMsgTime(m.created_at)
          }))}
          emptyMessage="Message the platform team. An admin will respond and keep you updated."
          value={chatInput}
          onChange={setChatInput}
          onSend={() => void sendChat()}
          sending={chatSending}
          onFileSelect={(file) => void shareFile(file)}
          focusKey={conversationId ?? undefined}
          messagesEndRef={messagesEndRef}
        />
        </>
      ) : null}

      {tab === "documents" && deal?.buyer_signed_at ? (
        <div className="card">
          <div className="card-header" style={{ justifyContent: "space-between" }}>
            <h3>Contracts & Documents</h3>
            {chatOpen ? (
              <>
                <input
                  ref={docFileInputRef}
                  type="file"
                  className="messenger-file-input"
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void attachDoc(file);
                  }}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => docFileInputRef.current?.click()}
                >
                  Upload Document
                </button>
              </>
            ) : null}
          </div>
          <div className="card-body">
            <div className="deal-contract-summary" style={{ marginBottom: 20, fontSize: 13, lineHeight: 1.8 }}>
              <h4 className="t-card" style={{ marginBottom: 8 }}>Recruiting agreements</h4>
              <p>
                <strong>Buyer:</strong> {deal.companies_buyer?.name ?? "—"}
                {deal.buyer_signed_at
                  ? ` — signed by ${deal.buyer_signer_name ?? "—"} on ${fmtDate(deal.buyer_signed_at)}`
                  : " — pending signature"}
              </p>
              <p>
                <strong>Seller:</strong> {deal.companies_seller?.name ?? "—"}
                {deal.seller_signed_at
                  ? ` — signed by ${deal.seller_signer_name ?? "—"} on ${fmtDate(deal.seller_signed_at)}`
                  : " — pending signature"}
              </p>
              <p className="t-secondary">
                Deal {deal.id}
                {isCarrierParty ? ` · Platform recruiting fee ${fmtRecruitingFee(workspace?.carrierPrice ?? deal.amount)}` : ""}
                {isRecruiterParty && workspace?.listPrice != null ? ` · Your listing price ${fmtRecruitingFee(workspace.listPrice)}` : ""}
                {isAdmin ? ` · List ${workspace?.listPrice != null ? fmtRecruitingFee(workspace.listPrice) : "—"} · Carrier ${fmtRecruitingFee(workspace?.carrierPrice ?? deal.amount)}` : ""}
              </p>
            </div>

            {chatOpen ? (
              workspace.documents.length === 0 ? (
                <p className="t-secondary">No additional documents shared yet.</p>
              ) : (
                <ul className="deal-doc-list">
                  {workspace.documents.map((d) => (
                    <li key={d.id}>
                      <FileText className="icon-sm" />
                      {d.download_url ? (
                        <a href={d.download_url} target="_blank" rel="noopener noreferrer" download={d.file_name}>
                          {d.file_name}
                        </a>
                      ) : (
                        <span>{d.file_name}</span>
                      )}
                      <span className="t-caption t-secondary">{fmtDate(d.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <p className="t-secondary">Shared documents unlock after both parties sign the recruiting agreement.</p>
            )}

            <div style={{ marginTop: 20 }}>
              <h4 className="t-card" style={{ marginBottom: 8 }}>Buyer agreement clauses</h4>
              <ul className="contract-clauses-compact">{BUYER_CONTRACT_CLAUSES.map((c) => <li key={c}>{c}</li>)}</ul>
            </div>
            {deal.seller_signed_at ? (
              <div style={{ marginTop: 16 }}>
                <h4 className="t-card" style={{ marginBottom: 8 }}>Seller agreement clauses</h4>
                <ul className="contract-clauses-compact">{SELLER_CONTRACT_CLAUSES.map((c) => <li key={c}>{c}</li>)}</ul>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      </div>
    </div>
  );
}
