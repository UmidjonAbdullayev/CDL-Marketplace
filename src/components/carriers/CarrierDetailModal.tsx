import { useCallback, useEffect, useRef, useState } from "react";
import {
  Building2,
  Clock,
  DollarSign,
  ExternalLink,
  MapPin,
  Send,
  ShieldCheck,
  Truck,
  Users,
  X
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MessengerPanel, type MessengerBubble } from "../chat/MessengerPanel";
import { StarRating, VerifiedBadge } from "../../lib/badges";
import { CARRIER_PLANS } from "../../lib/carrier-plans";
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

type ModalTab = "overview" | "send" | "chat";

type CarrierDetailModalProps = {
  carrier: CarrierCard;
  recruiterCompanyId: string;
  onClose: () => void;
  onSent: (submissionId: string) => void;
  showToast: (msg: string, type?: "" | "success" | "error") => void;
};

function formatMsgTime(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 3600000) return `${Math.max(1, Math.floor(diff / 60000))}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function CarrierDetailModal({
  carrier,
  recruiterCompanyId,
  onClose,
  onSent,
  showToast
}: CarrierDetailModalProps) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<ModalTab>("overview");
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

  const planMeta = CARRIER_PLANS.find((p) => p.id === carrier.plan);

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

  return (
    <div className="modal-overlay open carrier-detail-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal carrier-detail-modal" role="dialog" aria-labelledby="carrier-modal-title">
        <div className="modal-header">
          <div className="carrier-detail-modal-head">
            <div className="carrier-row-avatar"><Building2 className="icon-md" /></div>
            <div>
              <h3 id="carrier-modal-title">{carrier.name}</h3>
              <div className="t-caption t-secondary">
                {carrier.mcNumber || "Carrier"} {carrier.state ? `· ${carrier.state}` : ""}
              </div>
            </div>
            {carrier.mcVerified && carrier.profileVerified ? (
              <VerifiedBadge text="Verified" />
            ) : (
              <span className="badge badge-gray"><ShieldCheck className="icon-sm" /> Pending</span>
            )}
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <X className="icon-lg" />
          </button>
        </div>

        <div className="carrier-detail-tabs">
          <button type="button" className={`tab ${tab === "overview" ? "active" : ""}`} onClick={() => setTab("overview")}>
            Company &amp; Offers
          </button>
          <button type="button" className={`tab ${tab === "send" ? "active" : ""}`} onClick={() => setTab("send")}>
            Send Driver
          </button>
          <button type="button" className={`tab ${tab === "chat" ? "active" : ""}`} onClick={() => setTab("chat")}>
            Chat with Carrier
          </button>
        </div>

        <div className="modal-body carrier-detail-body">
          {tab === "overview" ? (
            <div className="carrier-detail-overview">
              <div className="carrier-offer-grid">
                <div className="carrier-offer-item">
                  <DollarSign className="icon-sm carrier-offer-icon" />
                  <div>
                    <div className="carrier-offer-label">Driver pay range</div>
                    <div className="carrier-offer-value">{carrier.driverPayRange || "Contact for rates"}</div>
                  </div>
                </div>
                <div className="carrier-offer-item">
                  <Clock className="icon-sm carrier-offer-icon" />
                  <div>
                    <div className="carrier-offer-label">Home time</div>
                    <div className="carrier-offer-value">{carrier.homeTimePolicy || "Not specified"}</div>
                  </div>
                </div>
                <div className="carrier-offer-item">
                  <MapPin className="icon-sm carrier-offer-icon" />
                  <div>
                    <div className="carrier-offer-label">Locations / lanes</div>
                    <div className="carrier-offer-value">{carrier.operatingRegions || carrier.serviceArea || "—"}</div>
                  </div>
                </div>
                <div className="carrier-offer-item">
                  <Truck className="icon-sm carrier-offer-icon" />
                  <div>
                    <div className="carrier-offer-label">Specialization</div>
                    <div className="carrier-offer-value">{carrier.specialization || "General freight"}</div>
                  </div>
                </div>
                <div className="carrier-offer-item">
                  <Users className="icon-sm carrier-offer-icon" />
                  <div>
                    <div className="carrier-offer-label">Fleet size</div>
                    <div className="carrier-offer-value">{carrier.fleetSize || "—"}</div>
                  </div>
                </div>
                <div className="carrier-offer-item">
                  <Building2 className="icon-sm carrier-offer-icon" />
                  <div>
                    <div className="carrier-offer-label">Plan tier</div>
                    <div className="carrier-offer-value">{carrier.planLabel} · {planMeta?.priceLabel ?? "Free"}</div>
                  </div>
                </div>
              </div>

              {carrier.benefitsOffered ? (
                <div className="card carrier-benefits-card">
                  <h4>Benefits &amp; perks</h4>
                  <p className="t-body">{carrier.benefitsOffered}</p>
                </div>
              ) : null}

              {carrier.about ? (
                <div className="card">
                  <h4>About the company</h4>
                  <p className="t-body t-secondary">{carrier.about}</p>
                </div>
              ) : null}

              <div className="carrier-detail-meta-row">
                <StarRating rating={carrier.rating} />
                <span className="t-caption t-secondary">
                  {carrier.leadsPurchased > 0 ? `${carrier.leadsPurchased} hires on platform` : "New carrier"}
                </span>
                {carrier.website ? (
                  <a href={carrier.website.startsWith("http") ? carrier.website : `https://${carrier.website}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                    Website <ExternalLink className="icon-sm" />
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}

          {tab === "send" ? (
            <div className="carrier-send-panel">
              <p className="t-body t-secondary">
                Select one of your active listings to send to {carrier.name}. They will receive the driver profile and can update hiring status in the submission workspace.
              </p>
              {listingsLoading ? (
                <p className="t-secondary">Loading your active drivers...</p>
              ) : listings.length === 0 ? (
                <div className="card">
                  <p className="t-body">No active listings available.</p>
                  <p className="t-caption t-secondary">List a driver first from My Listings, then return here to send them to carriers.</p>
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
                    <div className="card seller-contract-banner">
                      <p className="t-body">This driver was already sent to this carrier.</p>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => { navigate(`/submissions/${existingSubmissionId}`); onClose(); }}>
                        Open submission workspace
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {tab === "chat" ? (
            <div className="carrier-chat-panel">
              <p className="t-caption t-secondary" style={{ marginBottom: 8 }}>
                Message {carrier.name} before or after sending a driver. Discuss pay, home time, and fit.
              </p>
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

        <div className="modal-footer">
          {tab === "send" && listings.length > 0 ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={!selectedListingId || sending}
              onClick={() => void handleSendDriver()}
            >
              <Send className="icon-sm" />
              {existingSubmissionId ? "View submission" : sending ? "Sending..." : "Send driver to carrier"}
            </button>
          ) : tab === "overview" ? (
            <button type="button" className="btn btn-primary" onClick={() => setTab("send")}>
              <Send className="icon-sm" /> Send a driver
            </button>
          ) : null}
          <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
