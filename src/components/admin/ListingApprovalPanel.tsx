import { useCallback, useEffect, useState } from "react";
import { useApp } from "../../context/AppContext";
import { usePlatformRealtime } from "../../hooks/usePlatformRealtime";
import { invalidateDataViews } from "../../lib/dataInvalidation";
import { fmtPrice } from "../../lib/format";
import { computeListingPricing, maxRecruiterPrice } from "../../lib/listing-pricing";
import { rejectListing } from "../../services/marketplace";
import {
  approveListingWithCarrierPrice,
  assignListingToAdmin,
  fetchPendingApprovalsForAdmin,
  fetchPlatformAdmins,
  type PendingListingApproval,
  type PlatformAdmin,
  unwrapCompanyName
} from "../../services/platformAdmin";

type Props = {
  onRefreshStats?: () => void;
};

export function ListingApprovalPanel({ onRefreshStats }: Props) {
  const { sessionUser, showToast } = useApp();
  const [rows, setRows] = useState<PendingListingApproval[]>([]);
  const [admins, setAdmins] = useState<PlatformAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [markup, setMarkup] = useState(150);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const isManager = sessionUser?.adminRole === "manager";

  const load = async () => {
    if (!sessionUser?.id) return;
    setLoading(true);
    try {
      const [result, adminList] = await Promise.all([
        fetchPendingApprovalsForAdmin(sessionUser.id, sessionUser.adminRole ?? "admin"),
        isManager ? fetchPlatformAdmins() : Promise.resolve([] as PlatformAdmin[])
      ]);
      setRows(result.items);
      setAdmins(adminList);
    } catch {
      showToast("Failed to load approval queue", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [sessionUser?.id, sessionUser?.adminRole]);

  usePlatformRealtime(
    useCallback((topics) => {
      if (topics.has("admin") || topics.has("marketplace")) void load();
    }, [load])
  );

  const active = rows.find((r) => r.id === activeId) ?? null;

  const openReview = (row: PendingListingApproval) => {
    setActiveId(row.id);
    setMarkup(row.admin_markup ?? 150);
    setNotes(row.approval_notes ?? "");
  };

  const approve = async () => {
    if (!active || !sessionUser?.id) return;
    setBusy(true);
    try {
      await approveListingWithCarrierPrice(active.id, markup, notes, sessionUser.id);
      invalidateDataViews(["admin", "marketplace", "dashboard", "my-listings"]);
      showToast(`Published for carriers at ${fmtPrice(active.price + markup)}`, "success");
      setActiveId(null);
      onRefreshStats?.();
      await load();
    } catch {
      showToast("Failed to approve listing", "error");
    } finally {
      setBusy(false);
    }
  };

  const reject = async (id: number) => {
    setBusy(true);
    try {
      await rejectListing(id);
      invalidateDataViews(["admin", "my-listings"]);
      showToast("Listing rejected", "error");
      if (activeId === id) setActiveId(null);
      onRefreshStats?.();
      await load();
    } catch {
      showToast("Failed to reject listing", "error");
    } finally {
      setBusy(false);
    }
  };

  const assign = async (listingId: number, adminId: string) => {
    if (!adminId) return;
    try {
      await assignListingToAdmin(listingId, adminId);
      showToast("Case assigned", "success");
      await load();
    } catch {
      showToast("Failed to assign case", "error");
    }
  };

  const pricingPreview = active ? computeListingPricing(active.price, markup) : null;

  return (
    <div className="admin-approval-layout">
      <div className="card">
        <div className="card-header row">
          <h3>Listing approval queue</h3>
          <span className="t-caption t-secondary">
            {isManager ? "Manager view — all pending cases" : "Your assigned cases"}
          </span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Listing</th>
                <th>Seller</th>
                <th>Type</th>
                <th>List price</th>
                <th>Net to seller</th>
                {isManager ? <th>Assigned</th> : null}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={isManager ? 7 : 6} className="t-secondary">Loading queue…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={isManager ? 7 : 6} className="t-secondary">No pending listings</td></tr>
              ) : (
                rows.map((r) => {
                  const net = r.net_payout ?? Math.round(r.price * 0.85);
                  return (
                    <tr key={r.id} className={activeId === r.id ? "approval-row-active" : ""}>
                      <td>{r.first_name} {r.last_name.charAt(0)}. — {r.state}</td>
                      <td>{unwrapCompanyName(r.companies)}</td>
                      <td>{r.driver_type}</td>
                      <td>{fmtPrice(r.price)} <span className="t-caption t-secondary">max {fmtPrice(maxRecruiterPrice(r.driver_type))}</span></td>
                      <td>{fmtPrice(net)}</td>
                      {isManager ? (
                        <td>
                          <select
                            value={r.assigned_admin_id ?? ""}
                            onChange={(e) => void assign(r.id, e.target.value)}
                          >
                            <option value="">Unassigned</option>
                            {admins.filter((a) => a.admin_role === "admin").map((a) => (
                              <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                          </select>
                        </td>
                      ) : null}
                      <td>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => openReview(r)}>Review</button>
                        <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => void reject(r.id)}>Reject</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {active && pricingPreview ? (
        <div className="card admin-review-panel">
          <div className="card-header"><h3>Set carrier price</h3></div>
          <div className="card-body admin-review-body">
            <p className="t-secondary">
              Recruiters listed at <strong>{fmtPrice(active.price)}</strong> ({active.driver_type}).
              Platform fee (15%) is deducted from their payout. Carriers only see the final recruiting fee below.
            </p>
            <div className="admin-pricing-grid">
              <div><span className="lbl">Recruiter list price</span><strong>{fmtPrice(active.price)}</strong></div>
              <div><span className="lbl">Platform fee (15%)</span><strong>{fmtPrice(pricingPreview.platformFee)}</strong></div>
              <div><span className="lbl">Recruiter net payout</span><strong>{fmtPrice(pricingPreview.netPayout)}</strong></div>
              <div><span className="lbl">Carrier pays</span><strong>{fmtPrice(pricingPreview.carrierPrice)}</strong></div>
            </div>
            <div className="form-group" style={{ marginTop: 16 }}>
              <label>Additional platform markup for carrier ($)</label>
              <input
                type="number"
                min={0}
                step={25}
                value={markup}
                onChange={(e) => setMarkup(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
            <div className="form-group">
              <label>Internal notes</label>
              <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Pricing rationale, compliance notes…" />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void approve()}>Approve & publish to carriers</button>
              <button type="button" className="btn btn-secondary" onClick={() => setActiveId(null)}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
