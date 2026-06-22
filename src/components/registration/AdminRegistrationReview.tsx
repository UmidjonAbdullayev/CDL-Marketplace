import { useCallback, useEffect, useState } from "react";
import { usePlatformRealtime } from "../../hooks/usePlatformRealtime";
import { CheckCircle2, CreditCard, Shield, XCircle } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { CARRIER_PLANS } from "../../lib/carrier-plans";
import { fmtDate } from "../../lib/format";
import {
  approveRegistration,
  confirmCarrierPayment,
  displayAccountName,
  fetchRegistrationAccounts,
  rejectRegistration,
  suspendRegistration,
  updateRegistrationPlan,
  verifyRegistrationMc,
  verifyRegistrationProfile
} from "../../services/registration";
import type { CarrierPlanId, RegistrationAccount } from "../../types/registration";

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

export function AdminRegistrationReview() {
  const { showToast } = useApp();
  const [accounts, setAccounts] = useState<RegistrationAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<RegistrationAccount | null>(null);
  const [rejectReason, setRejectReason] = useState("");

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
    } catch {
      showToast("Action failed", "error");
    }
  };

  const pending = accounts.filter((a) => ["pending_review", "pending_payment"].includes(a.status));

  return (
    <div className="admin-reg-review">
      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 16 }}>
        <div className="stat-card"><div className="label">Pending Review</div><div className="value">{accounts.filter((a) => a.status === "pending_review").length}</div></div>
        <div className="stat-card"><div className="label">Pending Payment</div><div className="value">{accounts.filter((a) => a.status === "pending_payment").length}</div></div>
        <div className="stat-card"><div className="label">Active / Preview</div><div className="value">{accounts.filter((a) => ["active", "active_preview"].includes(a.status)).length}</div></div>
        <div className="stat-card"><div className="label">Policy Logs</div><div className="value">{accounts.filter((a) => a.policy_accepted).length}</div></div>
      </div>

      <div className="admin-reg-layout">
        <div className="card">
          <div className="card-header"><h3>Registration Queue</h3></div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Account</th><th>Type</th><th>Status</th><th>Plan</th><th>Policy</th><th>Submitted</th></tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="t-secondary">Loading...</td></tr>
                ) : accounts.length === 0 ? (
                  <tr><td colSpan={6} className="t-secondary">No registrations yet</td></tr>
                ) : (
                  accounts.map((a) => (
                    <tr
                      key={a.id}
                      className={selected?.id === a.id ? "row-selected" : ""}
                      style={{ cursor: "pointer" }}
                      onClick={() => setSelected(a)}
                    >
                      <td>{displayAccountName(a)}</td>
                      <td className="t-secondary">{a.account_type.replace("_", " ")}</td>
                      <td><span className={`badge ${statusBadge(a.status)}`}>{a.status}</span></td>
                      <td>{a.selected_plan ?? "—"}</td>
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
              <h3 className="t-section" style={{ marginBottom: 12 }}>{displayAccountName(selected)}</h3>
              <div className="t-secondary" style={{ fontSize: 13, lineHeight: 1.8, marginBottom: 16 }}>
                <div><strong>Email:</strong> {selected.email}</div>
                <div><strong>Status:</strong> {selected.status}</div>
                {selected.selected_plan ? <div><strong>Plan:</strong> {selected.selected_plan}</div> : null}
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

      {pending.length > 0 ? (
        <p className="t-caption t-secondary" style={{ marginTop: 12 }}>{pending.length} account(s) awaiting review or payment.</p>
      ) : null}
    </div>
  );
}
