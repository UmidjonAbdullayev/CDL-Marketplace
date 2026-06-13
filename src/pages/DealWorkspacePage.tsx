import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  MessageSquare,
  Paperclip,
  Send,
  User
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { ScoreBadge, StarRating, VerifiedBadge } from "../lib/badges";
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
  advanceHiringStage,
  fetchDealMessages,
  fetchDealWorkspace,
  sendDealMessage,
  signSellerContract,
  uploadDealDocument,
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
  const navigate = useNavigate();
  const { showToast, sessionUser } = useApp();

  const [workspace, setWorkspace] = useState<DealWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [messages, setMessages] = useState<Awaited<ReturnType<typeof fetchDealMessages>>>([]);
  const [chatInput, setChatInput] = useState("");
  const [sellerName, setSellerName] = useState(sessionUser?.name ?? "");
  const [sellerAgreed, setSellerAgreed] = useState(false);
  const [signing, setSigning] = useState(false);

  const load = useCallback(async () => {
    if (!dealId) return;
    try {
      if (isSupabaseConfigured) {
        const ws = await fetchDealWorkspace(dealId);
        setWorkspace(ws);
        if (ws?.conversationId) {
          setMessages(await fetchDealMessages(ws.conversationId));
        }
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

  const driver = workspace?.driver;
  const deal = workspace?.deal;
  const currentStageIdx = stageIndex(deal?.hiring_stage ?? "contract");
  const chatOpen = Boolean(deal?.buyer_signed_at && deal?.seller_signed_at);

  const myCompanyId = sessionUser?.companyId ?? "";
  const isSellerParty = deal?.seller_company_id === myCompanyId;
  const needsSellerSign = Boolean(deal && !deal.seller_signed_at && deal.buyer_signed_at);

  const sendChat = async () => {
    if (!chatInput.trim() || !workspace?.conversationId || !deal || !myCompanyId) return;
    const text = chatInput.trim();
    setChatInput("");
    await sendDealMessage(workspace.conversationId, text, myCompanyId, deal.buyer_company_id);
    setMessages(await fetchDealMessages(workspace.conversationId));
  };

  const attachDoc = async (name: string) => {
    if (!deal || !myCompanyId) return;
    await uploadDealDocument(deal.id, name, myCompanyId);
    showToast(`Shared: ${name}`, "success");
    await load();
    setTab("documents");
  };

  const sellerSign = async () => {
    if (!deal || !sellerAgreed || !sellerName.trim()) return;
    setSigning(true);
    try {
      await signSellerContract(deal.id, sellerName.trim());
      showToast("Seller agreement signed. Chat is now open.", "success");
      await load();
      setTab("chat");
    } catch {
      showToast("Failed to sign agreement", "error");
    } finally {
      setSigning(false);
    }
  };

  const advanceStage = async (stage: HiringStage) => {
    if (!deal) return;
    await advanceHiringStage(deal.id, stage);
    showToast(`Stage updated: ${stage}`, "success");
    await load();
  };

  const tabs = useMemo(
    () => [
      { id: "overview" as Tab, label: "Profile", icon: User },
      { id: "timeline" as Tab, label: "Timeline", icon: Clock },
      { id: "chat" as Tab, label: "Chat", icon: MessageSquare, disabled: !chatOpen },
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
    <div className="page active deal-workspace-page">
      <div className="page-header inline">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate("/ongoing-deals")}>
          <ArrowLeft className="icon-sm" /> Ongoing Deals
        </button>
        <div>
          <h2>{fullName(driver)}</h2>
          <p className="t-secondary">
            {deal.id} · {deal.companies_buyer?.name} ↔ {deal.companies_seller?.name}
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
                <div className="lbl" style={{ fontSize: 11, color: "var(--gray-500)", textTransform: "uppercase" }}>Platform Recruiting Fee</div>
                <div className="detail-price">{fmtRecruitingFee(deal.amount)}</div>
                <div className="detail-seller"><StarRating rating={driver.sellerRating} /> {driver.seller}</div>
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
            {chatOpen ? (
              <div style={{ display: "flex", gap: 8 }}>
                {(["screening", "interview", "orientation", "hired", "completed"] as HiringStage[]).map((s) => (
                  <button key={s} type="button" className="btn btn-ghost btn-sm" onClick={() => void advanceStage(s)}>
                    → {s}
                  </button>
                ))}
              </div>
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
        <div className="card deal-chat-card">
          <div className="chat-area" style={{ border: "none", minHeight: 360 }}>
            <div className="chat-header">Recruiting channel — {deal.companies_buyer?.name} &amp; {deal.companies_seller?.name}</div>
            <div className="chat-messages">
              {messages.map((m) => (
                <div key={m.id} className={`msg ${m.direction}`}>
                  {m.body}
                  {m.attachment_name ? <div className="msg-attachment"><Paperclip className="icon-sm" /> {m.attachment_name}</div> : null}
                  <div className="time">{formatMsgTime(m.created_at)}</div>
                </div>
              ))}
            </div>
            <div className="chat-input">
              <input
                type="text"
                placeholder="Message the other party..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void sendChat()}
              />
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void attachDoc("Offer_Letter.pdf")}>
                <Paperclip className="icon-sm" />
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void sendChat()}><Send className="icon-sm" /></button>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "documents" && deal?.buyer_signed_at ? (
        <div className="card">
          <div className="card-header" style={{ justifyContent: "space-between" }}>
            <h3>Contracts & Documents</h3>
            {chatOpen ? (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void attachDoc(`Document_${Date.now()}.pdf`)}>
                Upload Document
              </button>
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
              <p className="t-secondary">Deal {deal.id} · Platform recruiting fee {fmtRecruitingFee(deal.amount)}</p>
            </div>

            {chatOpen ? (
              workspace.documents.length === 0 ? (
                <p className="t-secondary">No additional documents shared yet.</p>
              ) : (
                <ul className="deal-doc-list">
                  {workspace.documents.map((d) => (
                    <li key={d.id}>
                      <FileText className="icon-sm" />
                      <span>{d.file_name}</span>
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
  );
}
