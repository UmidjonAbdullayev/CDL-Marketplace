import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { fmtPrice } from "../../lib/format";
import {
  assignDealListingAdmin,
  fetchPlatformAdmins,
  fetchPlatformOngoingDeals,
  type PlatformAdmin,
  type PlatformOngoingDeal
} from "../../services/platformAdmin";

export function AdminOngoingDealsPanel() {
  const navigate = useNavigate();
  const { sessionUser, showToast } = useApp();
  const [rows, setRows] = useState<PlatformOngoingDeal[]>([]);
  const [admins, setAdmins] = useState<PlatformAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const isManager = sessionUser?.adminRole === "manager";

  const load = async () => {
    if (!sessionUser?.id) return;
    setLoading(true);
    try {
      const [deals, adminList] = await Promise.all([
        fetchPlatformOngoingDeals(sessionUser.id, sessionUser.adminRole ?? "admin"),
        isManager ? fetchPlatformAdmins() : Promise.resolve([] as PlatformAdmin[])
      ]);
      setRows(deals);
      setAdmins(adminList);
    } catch {
      showToast("Failed to load ongoing deals", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [sessionUser?.id, sessionUser?.adminRole]);

  const assign = async (listingId: number | null, adminId: string) => {
    if (!listingId || !adminId) return;
    try {
      await assignDealListingAdmin(listingId, adminId);
      showToast("Deal case reassigned", "success");
      await load();
    } catch {
      showToast("Failed to reassign deal", "error");
    }
  };

  return (
    <div className="card">
      <div className="card-header row">
        <h3>Ongoing hiring deals</h3>
        <span className="t-caption t-secondary">
          {isManager ? "All platform deals — reassign admin cases" : "Deals on your assigned listings"}
        </span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Deal</th>
              <th>Driver</th>
              <th>Buyer</th>
              <th>Seller</th>
              <th>Stage</th>
              <th>Amount</th>
              {isManager ? <th>Assigned admin</th> : <th>Assigned to</th>}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={isManager ? 8 : 8} className="t-secondary">Loading deals…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="t-secondary">No ongoing deals</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.driver_label}</td>
                  <td>{r.buyer_name}</td>
                  <td>{r.seller_name}</td>
                  <td><span className="badge badge-blue">{r.hiring_stage}</span></td>
                  <td>{fmtPrice(r.amount)}</td>
                  <td>
                    {isManager ? (
                      <select
                        value={r.assigned_admin_id ?? ""}
                        onChange={(e) => void assign(r.listing_id, e.target.value)}
                      >
                        <option value="">Unassigned</option>
                        {admins.filter((a) => a.admin_role === "admin").map((a) => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                    ) : (
                      r.assigned_admin_name
                    )}
                  </td>
                  <td>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate(`/deals/${r.id}`)}>
                      Open workspace
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
