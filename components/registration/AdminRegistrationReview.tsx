import { useCallback, useEffect, useMemo, useState } from "react";
import { usePlatformRealtime } from "../../hooks/usePlatformRealtime";
import { AlertCircle, CheckCircle2, CreditCard, Shield, XCircle } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { CARRIER_PLANS, carrierPlanLabel } from "../../lib/carrier-plans";
import { fmtDate } from "../../lib/format";
import {
  approveRegistration,
  confirmCarrierPayment,
  displayAccountName,
  fetchRegistrationAccounts,
  grantCarrierCdlScoreCredits,
  rejectRegistration,
  suspendRegistration,
  updateRegistrationPlan,
  verifyRegistrationMc,
  verifyRegistrationProfile
} from "../../services/registration";
import type { CarrierPlanId, RegistrationAccount } from "../../types/registration";

type QueueFilter = "all" | "payment" | "review";

function statusBadge(status: string) {
  const map: Record<string, string> = {
    active_preview: "badge-blue",
    pending_payment: "badge-yellow",
    pending_review: "badge-purple",
    active: "badge-green",
    rejected: "badge-red",
    suspended: "badge-red"
  };
  return map[status] ?? "badge-gray";
}

function rowClass(account: RegistrationAccount, selectedId?: string): string {
  const classes = [selectedId === account.id ? "row-selected" : ""];
  if (account.status === "pending_payment") classes.push("row-pending-payment");
  else if (account.status === "pending_review") classes.push("row-pending-review");
  return classes.filter(Boolean).join(" ");
}

function sortAccounts(accounts: RegistrationAccount[]): RegistrationAccount[] {
  const rank = (status: string) => {
    if (status === "pending_payment") return 0;
    if (status === "pending_review") return 1;
    return 2;
  };
  return [...accounts].sort((a, b) => {
    const r = rank(a.status) - rank(b.status);
    if (r !== 0) return r;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export function AdminRegistrationReview() {
  const { showToast } = useApp();
  const [accounts, setAccounts] = useState<RegistrationAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<RegistrationAccount | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("all");

  const load = async () => {
    setLoading(true);
    try {
      setAccounts(await fetchRegistrationAccounts());
    } catch {
      showToast("Failed to load registrations", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  usePlatformRealtime(
    useCallback((topics) => {
      if (topics.has("admin")) void load();
    }, [])
  );

  const act = async (fn: () => Promise<void>, msg: string) => {
    try {
      await fn();
      showToast(msg, "success");
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Action failed";
      showToast(msg, "error");
    }
  };

  const pendingPayment = accounts.filter((a) => a.status === "pending_payment");
  const pendingReview = accounts.filter((a) => a.status === "pending_review");

  const visibleAccounts = useMemo(() => {
    const filtered =
      queueFilter === "payment"
        ? accounts.filter((a) => a.status === "pending_payment")
        : queueFilter === "review"
          ? accounts.filter((a) => a.status === "pending_review")
          : accounts;
    return sortAccounts(filtered);
  }, [accounts, queueFilter]);

  return (
    <div className="admin-reg-review">
      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 16 }}>
        <div className="stat-card"><div className="label">Pending Review</div><div className="value">{pendingReview.length}</div></div>
        <div className={`stat-card ${pendingPayment.length ? "stat-card-alert" : ""}`}>
          <div className="label">Pending Payment</div>
          <div className="value">{pendingPayment.length}</div>
        </div>
        <div className="stat-card"><div className="label">Active / Preview</div><div className="value">{accounts.filter((a) => ["active", "active_preview"].includes(a.status)).length}</div></div>
        <div className="stat-card"><div className="label">Policy Logs</div><div className="value">{accounts.filter((a) => a.policy_accepted).length}</div></div>
      </div>

      <div className="admin-queue-filters">
        <button type="button" className={`btn btn-sm ${queueFilter === "all" ? "btn-primary" : "btn-secondary"}`} onClick={() => setQueueFilter("all")}>
          All ({accounts.length})
        </button>
        <button type="button" className={`btn btn-sm ${queueFilter === "payment" ? "btn-primary" : "btn-secondary"}`} onClick={() => setQueueFilter("payment")}>
          Payment approval
          {pendingPayment.length ? <span className="admin-tab-badge">{pendingPayment.length}</span> : null}
        </button>
        <button type="button" className={`btn btn-sm ${queueFilter === "review" ? "btn-primary" : "btn-secondary"}`} onClick={() => setQueueFilter("review")}>
          Profile review
          {pendingReview.length ? <span className="admin-tab-badge">{pendingReview.length}</span> : null}
        </button>
      </div>

      <div className="admin-reg-layout">
        <div className="card">
          <div className="card-header"><h3>Registration Queue</h3></div>
          <div className="table-wrap">
            <table className="admin-reg-table">
              <thead>
                <tr><th>Account</th><th>Type</th><th>Status</th><th>Plan</th><th>Policy</th><th>Submitted</th></tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="t-secondary">Loading...</td></tr>
                ) : visibleAccounts.length === 0 ? (
                  <tr><td colSpan={6} className="t-secondary">No registrations in this view</td></tr>
                ) : (
                  visibleAccounts.map((a) => (
                    <tr
                      key={a.id}
                      className={rowClass(a, selected?.id)}
                      style={{ cursor: "pointer" }}
                      onClick={() => setSelected(a)}
                    >
                      <td>
                        <div className="admin-reg-account-cell">
                          {a.status === "pending_payment" ? (
                            <CreditCard className="icon-sm admin-reg-payment-icon" aria-hidden />
                          ) : a.status === "pending_review" ? (
                            <AlertCircle className="icon-sm admin-reg-review-icon" aria-hidden />
                          ) : null}
                          <span>{displayAccountName(a)}</span>
                        </div>
                      </td>
                      <td className="t-secondary">{a.account_type.replace("_", " ")}</td>
                      <td>
                        <span className={`badge ${statusBadge(a.status)}`}>
                          {a.status === "pending_payment" ? "Payment approval" : a.status.replace("_", " ")}
                        </span>
                      </td>
                      <td>{a.selected_plan ? carrierPlanLabel(a.selected_plan) : "—"}</td>
                      <td>{a.policy_accepted ? <CheckCircle2 className="icon-sm" style={{ color: "var(--success)" }} /> : <XCircle className="icon-sm" style={{ color: "var(--danger)" }} />}</td>
                      <td className="t-caption">{fmtDate(a.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card admin-reg-detail">
          {selected ? (
            <div className="card-body">
              {selected.status === "pending_payment" ? (
                <div className="admin-payment-approval-banner">
                  <CreditCard className="icon-md" />
                  <div>
                    <strong>Whop payment awaiting your approval</strong>
                    <p className="t-caption t-secondary">
                      Carrier selected {selected.selected_plan ? carrierPlanLabel(selected.selected_plan) : "a paid plan"}.
                      Verify payment on Whop, then confirm below to activate their plan.
                    </p>
                  </div>
                </div>
              ) : null}

              <h3 className="t-section" style={{ marginBottom: 12 }}>{displayAccountName(selected)}</h3>
              <div className="t-secondary" style={{ fontSize: 13, lineHeight: 1.8, marginBottom: 16 }}>
                <div><strong>Email:</strong> {selected.email}</div>
                <div><strong>Status:</strong> {selected.status}</div>
                {selected.selected_plan ? <div><strong>Plan:</strong> {carrierPlanLabel(selected.selected_plan)}</div> : null}
                <div><strong>Policy:</strong> {selected.policy_version} · {selected.policy_accepted_at ? fmtDate(selected.policy_accepted_at) : "—"}</div>
                {selected.accepted_ip_address ? <div><strong>IP:</strong> {selected.accepted_ip_address}</div> : null}
                {selected.rejection_reason ? <div style={{ color: "var(--danger)" }}><strong>Rejection:</strong> {selected.rejection_reason}</div> : null}
              </div>

              <pre className="admin-reg-profile-json">{JSON.stringify(selected.profile_data, null, 2)}</pre>

              <div className="admin-reg-actions">
                {selected.account_type === "carrier" ? (
                  <>
                    <select
                      defaultValue={selected.selected_plan ?? "free"}
                      onChange={(e) => void act(() => updateRegistrationPlan(selected.id, e.target.value as CarrierPlanId), "Plan updated")}
                    >
                      {CARRIER_PLANS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => void act(() => verifyRegistrationMc(selected.id, !selected.mc_verified), selected.mc_verified ? "MC unverified" : "MC verified")}>
                      {selected.mc_verified ? "Unverify MC" : "Verify MC"}
                    </button>
                  </>
                ) : null}
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => void act(() => verifyRegistrationProfile(selected.id, !selected.profile_verified), selected.profile_verified ? "Profile unverified" : "Profile verified")}>
                  <Shield className="icon-sm" /> {selected.profile_verified ? "Unverify Profile" : "Verify Profile"}
                </button>
                {selected.account_type === "carrier" && selected.status === "active" && selected.selected_plan && selected.selected_plan !== "free" ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => void (async () => {
                      try {
                        const credits = await grantCarrierCdlScoreCredits(
                          selected.id,
                          selected.selected_plan as CarrierPlanId
                        );
                        showToast(`CDL Score credits synced — ${credits} searches available`, "success");
                        await load();
                      } catch (err) {
                        showToast(err instanceof Error ? err.message : "Action failed", "error");
                      }
                    })()}
                  >
                    <Shield className="icon-sm" /> Sync CDL Score credits
                  </button>
                ) : null}
                {selected.account_type === "carrier" && selected.status === "pending_payment" ? (
                  <button
                    type="button"
                    className="btn btn-success btn-sm"
                    onClick={() => void act(() => confirmCarrierPayment(selected.id), "Whop payment confirmed — plan activated")}
                  >
                    <CreditCard className="icon-sm" /> Confirm Whop Payment
                  </button>
                ) : (
                  <button type="button" className="btn btn-success btn-sm" onClick={() => void act(() => approveRegistration(selected.id), "Account approved")}>Approve</button>
                )}
                <button type="button" className="btn btn-danger btn-sm" onClick={() => void act(() => suspendRegistration(selected.id), "Account suspended")}>Suspend</button>
              </div>

              <div className="admin-reject-row">
                <input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Rejection reason..." />
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  disabled={!rejectReason.trim()}
                  onClick={() => void act(async () => {
                    await rejectRegistration(selected.id, rejectReason.trim());
                    setRejectReason("");
                  }, "Account rejected")}
                >
                  Reject
                </button>
              </div>
            </div>
          ) : (
            <div className="card-body t-secondary">Select a registration to review profile, policy logs, and actions.</div>
          )}
        </div>
      </div>

      {pendingPayment.length > 0 ? (
        <p className="t-caption admin-payment-queue-note">
          <CreditCard className="icon-sm" /> {pendingPayment.length} carrier plan payment{pendingPayment.length === 1 ? "" : "s"} awaiting Whop confirmation.
        </p>
      ) : null}
    </div>
  );
}
