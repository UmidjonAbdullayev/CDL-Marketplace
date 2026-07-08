import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  MoreHorizontal,
  Send,
  Star
} from "lucide-react";
import { MessengerPanel, type MessengerBubble } from "../chat/MessengerPanel";
import { CarrierOffersSummary, CarrierRequirementsSummary } from "../carriers/CarrierOffersSummary";
import { CarrierOffersIncompleteNote } from "../carriers/CarrierOffersBanner";
import { toCarrierCardDisplay } from "../../lib/carrier-display";
import { carrierIsActive } from "../../lib/carrier-filters";
import {
  ensureInquiryConversation,
  fetchExistingSubmission,
  fetchRecruiterSendableListings,
  fetchSubmissionMessages,
  sendDriverToCarrier,
  sendSubmissionMessage,
  subscribeSubmissionMessages,
  type SendableListing
} from "../../services/driverSubmissions";
import type { CarrierCard } from "../../types/carriers";

type ProfileTab = "overview" | "pay" | "lanes" | "requirements" | "send" | "chat";

const BASE_TABS: { key: ProfileTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "pay", label: "Pay & Benefits" },
  { key: "lanes", label: "Lanes" },
  { key: "requirements", label: "Requirements" }
];

function formatMsgTime(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 3600000) return `${Math.max(1, Math.floor(diff / 60000))}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function CarrierProfileModal({
  carrier,
  recruiterCompanyId,
  isRecruiter,
  onClose,
  onSent,
  showToast,
  initialTab = "overview",
  preselectedListingId
}: {
  carrier: CarrierCard;
  recruiterCompanyId: string;
  isRecruiter: boolean;
  onClose: () => void;
  onSent: (submissionId: string) => void;
  showToast: (msg: string, type?: "" | "success" | "error") => void;
  initialTab?: ProfileTab;
  preselectedListingId?: number;
}) {
  const navigate = useNavigate();
  const display = toCarrierCardDisplay(carrier);
  const active = carrierIsActive(carrier);

  const [tab, setTab] = useState<ProfileTab>(initialTab);
  const [listings, setListings] = useState<SendableListing[]>([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [selectedListingId, setSelectedListingId] = useState<number | "">("");
  const [sending, setSending] = useState(false);
  const [existingSubmissionId, setExistingSubmissionId] = useState<string | null>(null);

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [messages, setMessages] = useState<MessengerBubble[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const tabs = isRecruiter
    ? [...BASE_TABS, { key: "send" as const, label: "Send Driver" }, { key: "chat" as const, label: "Chat" }]
    : [...BASE_TABS, { key: "chat" as const, label: "Chat" }];

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (preselectedListingId) setSelectedListingId(preselectedListingId);
  }, [preselectedListingId]);

  useEffect(() => {
    if (tab !== "send") return;
    setListingsLoading(true);
    void fetchRecruiterSendableListings()
      .then(setListings)
      .catch(() => setListings([]))
      .finally(() => setListingsLoading(false));
  }, [tab]);

  useEffect(() => {
    if (!selectedListingId) {
      setExistingSubmissionId(null);
      return;
    }
    void fetchExistingSubmission(selectedListingId, carrier.id)
      .then((sub) => setExistingSubmissionId(sub?.id ?? null))
      .catch(() => setExistingSubmissionId(null));
  }, [selectedListingId, carrier.id]);

  const pullMessages = useCallback(async () => {
    if (!conversationId) return;
    try {
      const rows = await fetchSubmissionMessages(conversationId);
      setMessages(
        rows.map((m) => ({
          id: m.id,
          body: m.body,
          isMine: m.sender_company_id === recruiterCompanyId,
          isSystem: !m.sender_company_id,
          attachmentName: m.attachment_name,
          attachmentPath: m.attachment_path,
          attachmentUrl: m.attachment_url,
          timeLabel: formatMsgTime(m.created_at)
        }))
      );
    } catch {
      /* background */
    }
  }, [conversationId, recruiterCompanyId]);

  useEffect(() => {
    if (tab !== "chat") return;
    void ensureInquiryConversation(carrier.id, recruiterCompanyId)
      .then(setConversationId)
      .catch(() => setConversationId(null));
  }, [tab, carrier.id, recruiterCompanyId]);

  useEffect(() => {
    if (conversationId) void pullMessages();
  }, [conversationId, pullMessages]);

  useEffect(() => {
    if (!conversationId) return;
    const unsub = subscribeSubmissionMessages(conversationId, () => void pullMessages());
    return unsub;
  }, [conversationId, pullMessages]);

  const sendChat = async () => {
    if (!chatInput.trim() || !conversationId || chatSending) return;
    const text = chatInput.trim();
    setChatInput("");
    setChatSending(true);
    try {
      await sendSubmissionMessage(conversationId, text, recruiterCompanyId, recruiterCompanyId);
      await pullMessages();
    } catch {
      showToast("Failed to send message", "error");
    } finally {
      setChatSending(false);
    }
  };

  const handleSendDriver = async () => {
    if (!selectedListingId || sending) return;
    if (existingSubmissionId) {
      navigate(`/submissions/${existingSubmissionId}`);
      onClose();
      return;
    }
    setSending(true);
    try {
      const { submissionId } = await sendDriverToCarrier(selectedListingId, carrier.id);
      showToast("Driver sent to carrier successfully", "success");
      onSent(submissionId);
      navigate(`/submissions/${submissionId}`);
      onClose();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to send driver", "error");
    } finally {
      setSending(false);
    }
  };

  const openSendTab = () => setTab("send");

  return (
    <div className="driver-profile-overlay" onClick={onClose} role="presentation">
      <div
        className="driver-profile-modal carrier-profile-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${carrier.name} carrier profile`}
      >
        <div className="dp-topbar">
          <button type="button" className="dp-back-link" onClick={onClose}>
            <ArrowLeft size={14} /> Back to carriers
          </button>
          <button type="button" className="dp-menu-btn" aria-label="More options">
            <MoreHorizontal size={18} />
          </button>
        </div>

        <div className="dp-header carrier-profile-header">
          <div className="dp-header-main">
            <div className="carrier-avatar-lg" style={{ background: display.avatarBg, color: display.avatarFg }}>
              {display.initials}
            </div>
            <div className="dp-identity">
              <div className="dp-name-row">
                <h2 className="dp-name">{carrier.name}</h2>
                <span className="carrier-mc-tag">{display.mcNumber}</span>
                <span className="carrier-rating-tag">
                  <Star size={11} className="icon-star-score" />
                  {display.rating} ({display.reviewCount})
                </span>
                <span className={`carrier-active-pill ${active ? "" : "is-pending"}`}>
                  <BadgeCheck size={11} /> {active ? "Active" : "Pending"}
                </span>
              </div>
              <p className="carrier-offer-title">{carrier.specialization || "General freight carrier"}</p>
            </div>
          </div>
          <div className="dp-header-actions">
            <div className="dp-fee-block">
              <div className="dp-fee-label">Pay Range</div>
              <div className="carrier-pay-highlight">{display.payRange}</div>
              <div className="dp-fee-sub">Fleet: {display.fleetSize}</div>
            </div>
            {isRecruiter ? (
              <button type="button" className="dp-btn-hire" onClick={openSendTab}>
                Send Driver
              </button>
            ) : (
              <button type="button" className="dp-btn-hire" onClick={() => setTab("chat")}>
                Message Carrier
              </button>
            )}
          </div>
        </div>

        <div className="dp-tabs">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`dp-tab ${tab === t.key ? "active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="dp-content">
          {tab === "overview" ? (
            <div className="dp-overview-grid">
              <section className="dp-summary-card">
                <h3>Carrier Summary</h3>
                <p className="dp-summary-bio">
                  {carrier.about ||
                    (carrier.offersComplete
                      ? `${carrier.name} is hiring ${display.equipment.toLowerCase()} drivers across ${display.location}.`
                      : "This carrier has not completed their offers & requirements profile.")}
                </p>
                {carrier.offersComplete ? (
                  <CarrierOffersSummary offers={carrier.offersRequirements} showIncompleteNote={false} />
                ) : (
                  <CarrierOffersIncompleteNote />
                )}
              </section>
              <aside className="dp-sidebar">
                <div className="dp-side-card">
                  <h4>Quick Stats</h4>
                  <ul className="dp-recruiter-stats">
                    <li><span>Rating</span><strong>{display.rating} ({display.reviewCount} hires)</strong></li>
                    <li><span>Fleet size</span><strong>{display.fleetSize}</strong></li>
                    <li><span>State</span><strong>{carrier.state || "—"}</strong></li>
                    <li><span>Search credits</span><strong>{carrier.searchCredits}</strong></li>
                  </ul>
                </div>
                <div className="dp-side-card">
                  <h4>Actions</h4>
                  <div className="dp-action-btns">
                    {isRecruiter ? (
                      <button type="button" className="dp-btn-hire" onClick={openSendTab}>
                        <Send size={14} /> Send Driver
                      </button>
                    ) : null}
                    <button type="button" className="dp-btn-outline" onClick={() => setTab("chat")}>
                      Message Carrier
                    </button>
                  </div>
                </div>
              </aside>
            </div>
          ) : null}

          {tab === "pay" ? (
            <div className="dp-tab-panel">
              {carrier.offersComplete ? (
                <CarrierOffersSummary offers={carrier.offersRequirements} showIncompleteNote={false} />
              ) : (
                <CarrierOffersIncompleteNote />
              )}
            </div>
          ) : null}

          {tab === "lanes" ? (
            <div className="dp-tab-panel">
              <p><strong>Operating regions:</strong> {display.location}</p>
              <p><strong>Service area:</strong> {carrier.serviceArea || "—"}</p>
              {carrier.offersRequirements?.statesOrLanes ? (
                <p><strong>Lanes detail:</strong> {carrier.offersRequirements.statesOrLanes}</p>
              ) : null}
            </div>
          ) : null}

          {tab === "requirements" ? (
            <div className="dp-tab-panel">
              {carrier.offersComplete ? (
                <CarrierRequirementsSummary offers={carrier.offersRequirements} />
              ) : (
                <CarrierOffersIncompleteNote />
              )}
            </div>
          ) : null}

          {tab === "send" && isRecruiter ? (
            <div className="dp-tab-panel">
              <p className="dp-summary-bio">
                Select one of your active listings to send to {carrier.name}. They will receive the driver profile and can update hiring status in the submission workspace.
              </p>
              {listingsLoading ? (
                <p className="t-secondary">Loading your active drivers...</p>
              ) : listings.length === 0 ? (
                <div className="dp-tab-placeholder">
                  <p>No active listings available. List a driver from My Drivers first.</p>
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label>Select driver listing</label>
                    <select
                      value={selectedListingId}
                      onChange={(e) => setSelectedListingId(e.target.value ? Number(e.target.value) : "")}
                    >
                      <option value="">Choose a driver...</option>
                      {listings.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.label}
                          {l.desired_weekly_pay ? ` · wants ${l.desired_weekly_pay}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  {existingSubmissionId ? (
                    <div className="dp-tab-placeholder">
                      <p>This driver was already sent to this carrier.</p>
                      <button type="button" className="dp-btn-outline" onClick={() => { navigate(`/submissions/${existingSubmissionId}`); onClose(); }}>
                        Open submission workspace
                      </button>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="dp-btn-hire"
                    disabled={!selectedListingId || sending}
                    onClick={() => void handleSendDriver()}
                    style={{ marginTop: 12 }}
                  >
                    {existingSubmissionId ? "View submission" : sending ? "Sending..." : "Send driver to carrier"}
                  </button>
                </>
              )}
            </div>
          ) : null}

          {tab === "chat" ? (
            <div className="dp-tab-panel">
              <MessengerPanel
                title={`Chat · ${carrier.name}`}
                hideHeader
                live
                messages={messages}
                emptyMessage="Start a conversation with this carrier."
                value={chatInput}
                onChange={setChatInput}
                onSend={() => void sendChat()}
                sending={chatSending}
                messagesEndRef={messagesEndRef}
                focusKey={tab}
                className="carrier-modal-chat"
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
