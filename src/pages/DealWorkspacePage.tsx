import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePlatformRealtime } from "../hooks/usePlatformRealtime";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Lock,
  User
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { MessengerPanel } from "../components/chat/MessengerPanel";
import { AdminAvatar } from "../components/ui/AdminAvatar";
import { CompanyReviewsPanel } from "../components/CompanyReviewsPanel";
import { DealReviewPanel } from "../components/reviews/DealReviewPanel";
import { useApp } from "../context/AppContext";
import { useExchangeData } from "../context/ExchangeDataContext";
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
  fetchDealMessages,
  fetchDealWorkspace,
  isOwnDealMessage,
  sendDealFileMessage,
  sendDealMessage,
  signSellerContract,
  subscribeDealMessages,
  subscribeDealWorkspace,
  uploadDealDocument,
  recordDealDocument,
  type DealMessageRow,
  type DealWorkspace
} from "../services/hiring";
import { markDealViewed } from "../services/dealViews";
import { DriverApplicationWorkspacePanel } from "../components/driver-applications/DriverApplicationWorkspacePanel";
import type { Driver, DriverCard } from "../types";

type PartyTab = "pipeline" | "contracts" | "documents" | "activity" | "application";

function formatMsgTime(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 3600000) return `${Math.max(1, Math.floor(diff / 60000))}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function fmtAvailability(avail: string): string {
  const d = new Date(avail);
  if (Number.isNaN(d.getTime()) || d <= new Date()) return "Available Now";
  return fmtDate(avail);
}

function stableScoreInRange(seed: string, min: number, max: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return min + (Math.abs(h) % (max - min + 1));
}

function cdlScorePct(driver: Driver, card: DriverCard | null, listingId?: number | null): number {
  const seed = String(listingId ?? `${driver.first}${driver.last}`);
  if (card?.hotScore && card.hotScore >= 80 && card.hotScore <= 99) return card.hotScore;
  if (driver.score === "green") return stableScoreInRange(seed, 92, 99);
  if (driver.score === "yellow") return stableScoreInRange(seed, 86, 91);
  return stableScoreInRange(seed, 80, 85);
}

function displayStatus(status: string): string {
  if (status === "Hiring Active" || status === "Contact Released") return "In Progress";
  if (status.includes("Awaiting") || status.includes("Contract")) return "Pending";
  return status;
}

function nextStepLabel(stage: string, chatOpen: boolean): string {
  if (!chatOpen) return "Awaiting signed agreements";
  const idx = stageIndex(stage);
  const current = HIRING_STAGES[idx];
  if (stage === "completed") return "Hiring process complete";
  const next = HIRING_STAGES[Math.min(idx + 1, HIRING_STAGES.length - 1)];
  return current?.key === stage && next ? `Awaiting ${next.label.toLowerCase()}` : "Platform admin will update the next milestone";
}

export default function DealWorkspacePage() {
  const { dealId } = useParams();
  const navigate = useNavigate();
  const { showToast, sessionUser, openDisputeModal } = useApp();
  const { refreshNotifications } = useExchangeData();

  const [workspace, setWorkspace] = useState<DealWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [partyTab, setPartyTab] = useState<PartyTab>("pipeline");
  const [messages, setMessages] = useState<DealMessageRow[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [sellerName, setSellerName] = useState(sessionUser?.name ?? "");
  const [sellerAgreed, setSellerAgreed] = useState(false);
  const [signing, setSigning] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const docFileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = isPlatformStaff(sessionUser);
  const myCompanyId = sessionUser?.companyId ?? "";
  const deal = workspace?.deal;
  const driver = workspace?.driver;
  const driverCard = workspace?.driverCard;
  const isBuyerParty = deal?.buyer_company_id === myCompanyId;
  const isSellerParty = deal?.seller_company_id === myCompanyId;
  const isCarrierParty = isBuyerParty && !isAdmin;
  const isRecruiterParty = isSellerParty && !isAdmin;
  const dealComplete = Boolean(
    deal && (deal.status === "Completed" || deal.hiring_stage === "completed")
  );
  const showPartyReview = dealComplete && (isCarrierParty || isRecruiterParty) && myCompanyId;

  const carrierChatOpen = Boolean(deal?.buyer_signed_at && workspace?.carrierConversationId);
  const recruiterChatOpen = Boolean(deal?.seller_signed_at && workspace?.recruiterConversationId);
  const chatOpen = isCarrierParty
    ? carrierChatOpen
    : isRecruiterParty
      ? recruiterChatOpen
      : false;

  const channelPartyId = isCarrierParty
    ? deal?.buyer_company_id
    : deal?.seller_company_id;

  const conversationId = isCarrierParty
    ? workspace?.carrierConversationId
    : workspace?.recruiterConversationId ?? null;

  const currentStageIdx = stageIndex(deal?.hiring_stage ?? "contract");
  const needsSellerSign = Boolean(deal && !deal.seller_signed_at && deal.buyer_signed_at);
  const counterpartyCompanyId = isBuyerParty ? deal?.seller_company_id : deal?.buyer_company_id;

  const recruitmentFee = useMemo(() => {
    const listPrice = workspace?.listPrice ?? null;
    const carrierPrice = workspace?.carrierPrice ?? deal?.amount ?? 0;
    if (isRecruiterParty) {
      return {
        label: "Your listing price",
        value: listPrice != null ? fmtRecruitingFee(listPrice) : "—"
      };
    }
    return {
      label: "Platform recruiting fee",
      value: fmtRecruitingFee(carrierPrice)
    };
  }, [workspace, deal, isRecruiterParty]);

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

  useEffect(() => {
    if (!dealId || isAdmin) return;
    const listingId = workspace?.deal?.listing_id ?? null;
    const unsub = subscribeDealWorkspace(dealId, () => void load(), listingId);
    return unsub;
  }, [dealId, isAdmin, load, workspace?.deal?.listing_id]);

  usePlatformRealtime(
    useCallback((topics) => {
      if (topics.has("deals")) void load();
    }, [load])
  );

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
  }, [conversationId, pullMessages]);

  useEffect(() => {
    if (!chatOpen || !conversationId) return;
    const unsub = subscribeDealMessages(conversationId, () => void pullMessages());
    return unsub;
  }, [chatOpen, conversationId, pullMessages]);

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
    setPartyTab("documents");
  };

  const sellerSign = async () => {
    if (!deal || !sellerAgreed || !sellerName.trim()) return;
    setSigning(true);
    try {
      await signSellerContract(deal.id, sellerName.trim());
      showToast("Seller agreement signed. Platform chat is open.", "success");
      await load();
    } catch {
      showToast("Failed to sign agreement", "error");
    } finally {
      setSigning(false);
    }
  };

  useEffect(() => {
    if (!loading && isAdmin && deal?.id) {
      navigate("/admin", { replace: true, state: { dealId: deal.id } });
    }
  }, [loading, isAdmin, deal?.id, navigate]);

  const pipelineEvents = useMemo(() => {
    return (workspace?.events ?? [])
      .filter((e) => e.stage !== "admin_note" && e.stage !== "document")
      .slice()
      .reverse();
  }, [workspace?.events]);

  const activityEvents = useMemo(() => {
    return (workspace?.events ?? []).filter((e) => e.stage !== "admin_note").slice().reverse();
  }, [workspace?.events]);

  useEffect(() => {
    if (!dealId || !myCompanyId || loading || !deal) return;
    markDealViewed(myCompanyId, dealId);
    void refreshNotifications();
  }, [dealId, myCompanyId, deal?.updated_at, loading, refreshNotifications]);

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

  if (isAdmin) {
    return (
      <div className="page active">
        <p className="t-secondary">Opening admin console…</p>
      </div>
    );
  }

  const scorePct = cdlScorePct(driver, driverCard ?? null, deal.listing_id);
  const driverTypeTag = driverCard?.driverType ?? "Driver";

  const assignedAdmin = workspace?.assignedAdmin;
  const adminChatLabel = assignedAdmin?.name ?? "Platform Admin";
  const adminInitials = assignedAdmin?.initials ?? "PA";

  const chatPanel = chatOpen ? (
    <MessengerPanel
      className="messenger-panel--party-rail"
      title={adminChatLabel}
      hideHeader
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
  ) : (
    <div className="deal-party-chat-locked">
      <Lock className="icon-sm" />
      <p className="t-secondary">
        {isRecruiterParty && needsSellerSign
          ? "Sign the seller agreement to open platform chat."
          : "Platform chat opens after the recruiting agreement is signed."}
      </p>
    </div>
  );

  return (
    <div className="page active deal-workspace-page deal-workspace-page--party">
      <header className="deal-party-header deal-party-header--compact">
        <div className="deal-party-header-left">
          <h2>Deal {deal.id}</h2>
          <span className={`badge ${statusBadgeClass(deal.status)}`}>{displayStatus(deal.status)}</span>
        </div>
        <div className="deal-party-header-actions">
          <button type="button" className="btn btn-danger btn-sm deal-dispute-btn" onClick={() => openDisputeModal(deal.id)}>
            <AlertTriangle className="icon-sm" /> Dispute
          </button>
        </div>
      </header>

      {showPartyReview ? (
        <DealReviewPanel
          dealId={deal.id}
          myCompanyId={myCompanyId}
          onSubmitted={() => showToast("Thank you — your review was submitted", "success")}
        />
      ) : null}

      <div className="deal-party-body">
      {needsSellerSign && isSellerParty ? (
        <div className="card seller-contract-banner">
          <div className="card-body">
            <h3>Seller representation agreement required</h3>
            <p className="t-secondary" style={{ marginBottom: 12 }}>
              {isRecruiterParty
                ? `A carrier signed the recruiting agreement on ${deal.buyer_signed_at ? fmtDate(deal.buyer_signed_at) : "—"}. Countersign to open platform chat and document sharing.`
                : `Buyer signed on ${deal.buyer_signed_at ? fmtDate(deal.buyer_signed_at) : "—"} by ${deal.buyer_signer_name}. Countersign to open platform chat and document sharing.`}
            </p>
            {deal.buyer_company_id && !isRecruiterParty ? (
              <div style={{ marginBottom: 16 }}>
                <CompanyReviewsPanel
                  companyId={deal.buyer_company_id}
                  compact
                  onViewAll={() => navigate(`/company/${deal.buyer_company_id}/reviews`)}
                />
              </div>
            ) : null}
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

      <div className="deal-party-layout">
        <div className="deal-party-main">
          <div className="card deal-driver-card">
            <div className="card-header">
              <h3><User className="icon-sm" /> Driver Profile</h3>
            </div>
            <div className="card-body">
              <div className="deal-driver-head">
                <div>
                  <h4>{fullName(driver)}</h4>
                  <div className="deal-driver-tags">
                    <span className="badge badge-blue">{driver.cdl}</span>
                    <span className="badge badge-green">{driverTypeTag}</span>
                    {driver.verified ? <VerifiedBadge text="Verified" /> : null}
                  </div>
                </div>
              </div>
              <dl className="deal-driver-details">
                <div><dt>Experience</dt><dd>{driver.expLabel}</dd></div>
                <div><dt>Trailer Type</dt><dd>{driver.equip}</dd></div>
                <div><dt>CDL Score</dt><dd><span className="deal-score-pill">{scorePct}%</span></dd></div>
                <div><dt>{recruitmentFee.label}</dt><dd className="deal-fee-value">{recruitmentFee.value}</dd></div>
                <div><dt>Location</dt><dd>{driver.state}</dd></div>
                <div><dt>Availability</dt><dd>{fmtAvailability(driver.avail)}</dd></div>
              </dl>
              {chatOpen ? (
                <div className="deal-driver-extra">
                  <ScoreBadge score={driver.score} />
                  {!isRecruiterParty ? (
                    <>
                      <div className="deal-driver-contact"><span className="lbl">Phone</span>{driver.phone}</div>
                      <div className="deal-driver-contact"><span className="lbl">Email</span>{driver.email}</div>
                    </>
                  ) : null}
                </div>
              ) : (
                <p className="t-caption t-secondary deal-driver-lock-note">
                  Contact details unlock after agreements are signed. All coordination goes through platform admins.
                </p>
              )}
            </div>
          </div>

          <div className="card deal-party-tabs-card">
            <div className="deal-party-tabs">
              {([
                { id: "pipeline" as PartyTab, label: "Hiring Pipeline" },
                { id: "application" as PartyTab, label: "Application" },
                { id: "contracts" as PartyTab, label: "Contracts" },
                { id: "documents" as PartyTab, label: "Documents" },
                { id: "activity" as PartyTab, label: "Activity" }
              ]).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`deal-party-tab ${partyTab === t.id ? "active" : ""}`}
                  onClick={() => setPartyTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="card-body deal-party-tab-body">
              {partyTab === "pipeline" ? (
                <>
                  <div className="deal-pipeline-stepper">
                    {HIRING_STAGES.map((stage, i) => {
                      const done = i < currentStageIdx || (i === currentStageIdx && deal.hiring_stage === "completed");
                      const current = i === currentStageIdx && deal.hiring_stage !== "completed";
                      const event = workspace.events.find((e) => e.stage === stage.key);
                      return (
                        <div key={stage.key} className={`deal-pipeline-step ${done ? "done" : ""} ${current ? "current" : ""}`}>
                          <div className="deal-pipeline-dot">
                            {done ? <CheckCircle2 className="icon-sm" /> : i + 1}
                          </div>
                          <strong>{stage.label}</strong>
                          {current ? <span className="deal-pipeline-current">Current</span> : null}
                          {event ? <span className="t-caption">{fmtDate(event.created_at)}</span> : null}
                        </div>
                      );
                    })}
                  </div>
                  <div className="deal-pipeline-details">
                    <div>
                      <h4>Pipeline details</h4>
                      <ul className="deal-pipeline-list">
                        {pipelineEvents.length === 0 ? (
                          <li className="t-secondary">No milestones recorded yet.</li>
                        ) : (
                          pipelineEvents.slice(0, 6).map((e) => (
                            <li key={e.id}>
                              <strong>{e.title}</strong>
                              <span>{fmtDate(e.created_at)}</span>
                            </li>
                          ))
                        )}
                      </ul>
                      <p className="deal-next-step">
                        <span className="lbl">Next step</span>
                        {nextStepLabel(deal.hiring_stage, Boolean(chatOpen))}
                      </p>
                    </div>
                    <div className="deal-help-box">
                      <h4>Need help?</h4>
                      <p className="t-secondary">Platform admins manage hiring stages and coordinate both parties.</p>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => openDisputeModal(deal.id)}>
                        <AlertTriangle className="icon-sm" /> Dispute Deal
                      </button>
                    </div>
                  </div>
                  <p className="t-caption t-secondary deal-timeline-note">
                    Timeline updates are managed by platform admins only.
                  </p>
                </>
              ) : null}

              {partyTab === "application" ? (
                <DriverApplicationWorkspacePanel
                  dealId={deal.id}
                  listingId={deal.listing_id ?? undefined}
                  carrierCompanyId={deal.buyer_company_id ?? undefined}
                  canManage={isRecruiterParty || isCarrierParty}
                />
              ) : null}

              {partyTab === "contracts" ? (
                <div className="deal-contracts-panel">
                  <h4>Recruiting agreements</h4>
                  {isRecruiterParty ? (
                    <>
                      <p>
                        <strong>Carrier:</strong>
                        {deal.buyer_signed_at
                          ? ` Signed on ${fmtDate(deal.buyer_signed_at)}`
                          : " Pending signature"}
                      </p>
                      <p>
                        <strong>Your listing:</strong>
                        {deal.seller_signed_at
                          ? ` You signed on ${fmtDate(deal.seller_signed_at)}`
                          : " Awaiting your signature"}
                      </p>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                  <p className="deal-contract-fee">
                    <strong>{recruitmentFee.label}:</strong> {recruitmentFee.value}
                  </p>
                  <div className="contract-sign-status">
                    <div>{deal.buyer_signed_at ? <CheckCircle2 className="icon-sm" style={{ color: "var(--success)" }} /> : <Clock className="icon-sm" />} {isRecruiterParty ? "Carrier signed" : "Buyer signed"}</div>
                    <div>{deal.seller_signed_at ? <CheckCircle2 className="icon-sm" style={{ color: "var(--success)" }} /> : <Clock className="icon-sm" />} {isRecruiterParty ? "You signed" : "Seller signed"}</div>
                  </div>
                  {counterpartyCompanyId && !isRecruiterParty ? (
                    <div style={{ marginTop: 16 }}>
                      <h4>Partner reviews</h4>
                      <CompanyReviewsPanel
                        companyId={counterpartyCompanyId}
                        compact
                        onViewAll={() => navigate(`/company/${counterpartyCompanyId}/reviews`)}
                      />
                    </div>
                  ) : null}
                  {!isRecruiterParty ? (
                    <>
                      <h4 style={{ marginTop: 20 }}>Buyer agreement clauses</h4>
                      <ul className="contract-clauses-compact">{BUYER_CONTRACT_CLAUSES.map((c) => <li key={c}>{c}</li>)}</ul>
                    </>
                  ) : null}
                  {deal.seller_signed_at || isRecruiterParty ? (
                    <>
                      <h4 style={{ marginTop: 16 }}>Seller agreement clauses</h4>
                      <ul className="contract-clauses-compact">{SELLER_CONTRACT_CLAUSES.map((c) => <li key={c}>{c}</li>)}</ul>
                    </>
                  ) : null}
                </div>
              ) : null}

              {partyTab === "documents" ? (
                <>
                  <div className="deal-docs-toolbar">
                    <h4>Shared documents</h4>
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
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => docFileInputRef.current?.click()}>
                          Upload Document
                        </button>
                      </>
                    ) : null}
                  </div>
                  {chatOpen ? (
                    workspace.documents.length === 0 ? (
                      <p className="t-secondary">No documents shared yet.</p>
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
                    <p className="t-secondary">Documents unlock after both parties sign the recruiting agreement.</p>
                  )}
                  {chatOpen && driver.docs.length > 0 ? (
                    <>
                      <h4 style={{ marginTop: 20 }}>Listing documents</h4>
                      <ul className="t-secondary" style={{ paddingLeft: 20 }}>{driver.docs.map((doc) => <li key={doc}>{doc}</li>)}</ul>
                    </>
                  ) : null}
                </>
              ) : null}

              {partyTab === "activity" ? (
                <div className="admin-activity-feed">
                  {activityEvents.length === 0 ? (
                    <p className="t-secondary">No activity yet.</p>
                  ) : (
                    activityEvents.map((e) => (
                      <div key={e.id} className="admin-activity-item">
                        <Clock className="icon-sm" />
                        <div>
                          <strong>{e.title}</strong>
                          {e.description ? <p className="t-secondary">{e.description}</p> : null}
                          <span className="t-caption">{fmtDate(e.created_at)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <aside className="deal-party-rail">
          <div className="card deal-party-chat-card">
            <div className="deal-party-chat-head">
              <h3>Chat with Admin</h3>
              <div className="deal-admin-presence">
                <AdminAvatar
                  name={adminChatLabel}
                  initials={adminInitials}
                  avatarUrl={assignedAdmin?.avatarUrl}
                  size="sm"
                />
                <div className="deal-admin-presence-text">
                  <strong>{adminChatLabel}</strong>
                  <span className="deal-admin-online"><span className="deal-online-dot" /> Assigned admin</span>
                </div>
              </div>
            </div>
            {chatPanel}
          </div>
        </aside>
      </div>
      </div>
    </div>
  );
}
