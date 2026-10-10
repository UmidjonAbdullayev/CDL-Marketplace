import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Building2, Clock, Eye, User } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { MessengerPanel, type MessengerBubble } from "../components/chat/MessengerPanel";
import { useApp } from "../context/AppContext";
import {
  CARRIER_UPDATABLE_STATUSES,
  DRIVER_SUBMISSION_STAGES,
  submissionStageIndex,
  submissionStatusBadgeClass,
  submissionStatusLabel,
  type DriverSubmissionStatus
} from "../lib/driver-submissions";
import { fmtDate } from "../lib/format";
import { isSupabaseConfigured } from "../lib/supabase";
import {
  fetchSubmissionMessages,
  fetchSubmissionWorkspace,
  markSubmissionViewed,
  sendSubmissionMessage,
  subscribeSubmissionMessages,
  subscribeSubmissionWorkspace,
  updateSubmissionStatus,
  type SubmissionWorkspace
} from "../services/driverSubmissions";
import { DriverApplicationWorkspacePanel } from "../components/driver-applications/DriverApplicationWorkspacePanel";

function formatMsgTime(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 3600000) return `${Math.max(1, Math.floor(diff / 60000))}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function SubmissionWorkspacePage() {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const { showToast, sessionUser } = useApp();
  const myCompanyId = sessionUser?.companyId ?? "";

  const [workspace, setWorkspace] = useState<SubmissionWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusDraft, setStatusDraft] = useState<DriverSubmissionStatus>("contacted");
  const [commentDraft, setCommentDraft] = useState("");
  const [updating, setUpdating] = useState(false);

  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [messages, setMessages] = useState<MessengerBubble[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const submission = workspace?.submission;
  const isRecruiter = submission?.recruiter_company_id === myCompanyId;
  const isCarrier = submission?.carrier_company_id === myCompanyId;
  const canUpdateStatus = isCarrier;
  const conversationId = workspace?.conversationId ?? null;
  const channelPartyId = isCarrier ? submission?.carrier_company_id : submission?.recruiter_company_id;

  const load = useCallback(async () => {
    if (!submissionId || !myCompanyId) return;
    try {
      if (isSupabaseConfigured) {
        const ws = await fetchSubmissionWorkspace(submissionId);
        setWorkspace(ws);
        if (ws?.submission.status) {
          setStatusDraft(ws.submission.status as DriverSubmissionStatus);
        }
        if (ws?.submission) {
          const role = ws.submission.recruiter_company_id === myCompanyId ? "recruiter" : "carrier";
          if (
            (role === "recruiter" && ws.submission.recruiter_company_id === myCompanyId) ||
            (role === "carrier" && ws.submission.carrier_company_id === myCompanyId)
          ) {
            await markSubmissionViewed(submissionId, myCompanyId, role);
          }
        }
      }
    } catch {
      showToast("Failed to load submission", "error");
    } finally {
      setLoading(false);
    }
  }, [submissionId, myCompanyId, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!submissionId) return;
    const unsub = subscribeSubmissionWorkspace(submissionId, () => void load());
    return unsub;
  }, [submissionId, load]);

  const pullMessages = useCallback(async () => {
    if (!conversationId || !channelPartyId) return;
    try {
      const rows = await fetchSubmissionMessages(conversationId);
      setMessages(
        rows.map((m) => ({
          id: m.id,
          body: m.body,
          isMine: m.sender_company_id === myCompanyId,
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
  }, [conversationId, channelPartyId, myCompanyId]);

  useEffect(() => {
    if (conversationId) void pullMessages();
  }, [conversationId, pullMessages]);

  useEffect(() => {
    if (!conversationId) return;
    const unsub = subscribeSubmissionMessages(conversationId, () => void pullMessages());
    return unsub;
  }, [conversationId, pullMessages]);

  const sendChat = async () => {
    if (!chatInput.trim() || !conversationId || !myCompanyId || !channelPartyId || chatSending) return;
    const text = chatInput.trim();
    setChatInput("");
    setChatSending(true);
    try {
      await sendSubmissionMessage(conversationId, text, myCompanyId, channelPartyId);
      await pullMessages();
    } catch {
      showToast("Failed to send message", "error");
    } finally {
      setChatSending(false);
    }
  };

  const applyStatus = async () => {
    if (!submissionId || !myCompanyId || updating) return;
    if (statusDraft === "refused" && !commentDraft.trim()) {
      showToast("Please add a reason when refusing a driver", "error");
      return;
    }
    setUpdating(true);
    try {
      await updateSubmissionStatus(submissionId, statusDraft, commentDraft, myCompanyId);
      setCommentDraft("");
      showToast("Status updated", "success");
      await load();
    } catch {
      showToast("Failed to update status", "error");
    } finally {
      setUpdating(false);
    }
  };

  const withdraw = async () => {
    if (!submissionId || !myCompanyId || updating) return;
    setUpdating(true);
    try {
      await updateSubmissionStatus(submissionId, "withdrawn", commentDraft || "Withdrawn by recruiter", myCompanyId);
      showToast("Submission withdrawn", "success");
      await load();
    } catch {
      showToast("Failed to withdraw", "error");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="page active">
        <p className="t-secondary">Loading submission workspace...</p>
      </div>
    );
  }

  if (!workspace || !submission) {
    return (
      <div className="page active">
        <p className="t-secondary">Submission not found.</p>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate("/my-drivers")}>
          Back to My Drivers
        </button>
      </div>
    );
  }

  const driver = workspace.driver;
  const currentIdx = submissionStageIndex(submission.status);
  const counterpartyName = isRecruiter ? workspace.carrierName : workspace.recruiterName;

  return (
    <div className={`page active submission-workspace-page ${isCarrier ? "submission-workspace-page--carrier" : ""}`}>
      <div className="deal-workspace-top">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate("/my-drivers")}>
          <ArrowLeft className="icon-sm" /> Back to My Drivers
        </button>
        <div className="deal-workspace-title">
          <h2>{isCarrier ? "Review sent driver" : "Sent driver"} · {driver ? `${driver.first_name} ${driver.last_name.charAt(0)}.` : "Driver"}</h2>
          <div className="deal-workspace-sub">
            <Building2 className="icon-sm" /> {counterpartyName}
            <span className={`badge ${submissionStatusBadgeClass(submission.status)}`}>
              {submissionStatusLabel(submission.status)}
            </span>
          </div>
        </div>
      </div>

      {canUpdateStatus ? (
        <div className="card submission-carrier-actions-banner">
          <h3>Update driver hiring stage</h3>
          <p className="t-caption t-secondary">Move this driver through your hiring pipeline. The recruiter is notified on every update.</p>
          <div className="submission-carrier-actions-row">
            <select value={statusDraft} onChange={(e) => setStatusDraft(e.target.value as DriverSubmissionStatus)}>
              {CARRIER_UPDATABLE_STATUSES.map((s) => (
                <option key={s} value={s}>{submissionStatusLabel(s)}</option>
              ))}
            </select>
            <input
              type="text"
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              placeholder={statusDraft === "refused" ? "Reason required if refusing" : "Add a note (optional)"}
            />
            <button type="button" className="btn btn-primary btn-sm" disabled={updating} onClick={() => void applyStatus()}>
              {updating ? "Saving..." : "Update stage"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="submission-workspace-layout">
        <div className="submission-workspace-main">
          <div className="card submission-pipeline-card">
            <h3>Hiring pipeline</h3>
            <div className="deal-pipeline-stepper">
              {DRIVER_SUBMISSION_STAGES.filter((s) => s.key !== "withdrawn").map((stage, idx) => {
                const done = idx <= currentIdx && submission.status !== "refused";
                const active = stage.key === submission.status;
                const refused = submission.status === "refused" && stage.key === "refused";
                return (
                  <div
                    key={stage.key}
                    className={`deal-pipeline-step ${done ? "done" : ""} ${active || refused ? "current" : ""}`}
                  >
                    <div className="deal-pipeline-dot" />
                    <div>
                      <strong>{stage.label}</strong>
                      <div className="t-caption t-secondary">{stage.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            {submission.status_comment ? (
              <div className="submission-status-comment">
                <strong>Latest note:</strong> {submission.status_comment}
              </div>
            ) : null}
            {isRecruiter ? (
              <div className="submission-carrier-viewed">
                <Eye className="icon-sm" />
                {submission.carrier_last_viewed_at
                  ? `Carrier last opened this case on ${fmtDate(submission.carrier_last_viewed_at)}`
                  : "Carrier has not opened this case yet"}
              </div>
            ) : null}
          </div>

          {canUpdateStatus ? (
            <div className="card submission-carrier-detail-panel">
              <h3>Detailed status update</h3>
              <p className="t-caption t-secondary">Add more context when moving stages (required when refusing).</p>
              <div className="form-row">
                <div className="form-group">
                  <label>Status</label>
                  <select value={statusDraft} onChange={(e) => setStatusDraft(e.target.value as DriverSubmissionStatus)}>
                    {CARRIER_UPDATABLE_STATUSES.map((s) => (
                      <option key={s} value={s}>{submissionStatusLabel(s)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Comment {statusDraft === "refused" ? "*" : "(optional)"}</label>
                <textarea
                  rows={3}
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  placeholder={statusDraft === "refused" ? "Why was this driver refused?" : "Add context for the recruiter..."}
                />
              </div>
              <button type="button" className="btn btn-primary btn-sm" disabled={updating} onClick={() => void applyStatus()}>
                {updating ? "Updating..." : "Update status"}
              </button>
            </div>
          ) : isRecruiter && submission.status !== "withdrawn" && submission.status !== "hired" && submission.status !== "refused" ? (
            <div className="card">
              <h3>Withdraw submission</h3>
              <div className="form-group">
                <label>Reason (optional)</label>
                <textarea rows={2} value={commentDraft} onChange={(e) => setCommentDraft(e.target.value)} />
              </div>
              <button type="button" className="btn btn-secondary btn-sm" disabled={updating} onClick={() => void withdraw()}>
                Withdraw driver
              </button>
            </div>
          ) : null}

          <div className="card">
            <h3>Driver application</h3>
            <DriverApplicationWorkspacePanel
              submissionId={submission.id}
              listingId={submission.listing_id ?? undefined}
              carrierCompanyId={submission.carrier_company_id}
              canManage={isRecruiter || isCarrier}
              compact
            />
          </div>

          <div className="card">
            <h3>Activity log</h3>
            <div className="submission-events-list">
              {workspace.events.length === 0 ? (
                <p className="t-secondary">No events yet.</p>
              ) : (
                workspace.events.map((evt) => (
                  <div key={evt.id} className="submission-event-row">
                    <Clock className="icon-sm t-secondary" />
                    <div>
                      <div className="t-body">{submissionStatusLabel(evt.status)}</div>
                      {evt.comment ? <div className="t-caption t-secondary">{evt.comment}</div> : null}
                      <div className="t-caption t-secondary">{fmtDate(evt.created_at)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <aside className="submission-workspace-side">
          {driver ? (
            <div className="card">
              <h3><User className="icon-sm" /> Driver profile</h3>
              <div className="t-body">{driver.first_name} {driver.last_name.charAt(0)}.</div>
              <div className="t-caption t-secondary">{driver.cdl_class} · {driver.driver_type}</div>
              <div className="t-caption t-secondary">{driver.equipment} · {driver.state}</div>
              <div className="t-caption t-secondary">{driver.years_exp}+ years experience</div>
              {driver.desired_weekly_pay ? (
                <div className="t-caption" style={{ marginTop: 8 }}>Desired pay: {driver.desired_weekly_pay}</div>
              ) : null}
              {driver.weeks_out_preference ? (
                <div className="t-caption">Home time pref: {driver.weeks_out_preference}</div>
              ) : null}
              {driver.company_expectations ? (
                <div className="t-caption t-secondary" style={{ marginTop: 8 }}>{driver.company_expectations}</div>
              ) : null}
            </div>
          ) : null}

          <div className="card submission-chat-card">
            <MessengerPanel
              title={`Chat · ${counterpartyName}`}
              live
              messages={messages}
              emptyMessage="Message the carrier about this driver."
              value={chatInput}
              onChange={setChatInput}
              onSend={() => void sendChat()}
              sending={chatSending}
              messagesEndRef={messagesEndRef}
              focusKey={submissionId}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
