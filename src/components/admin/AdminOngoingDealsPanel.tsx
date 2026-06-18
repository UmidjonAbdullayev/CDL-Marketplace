import { useEffect, useMemo, useState } from "react";
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
  const [adminFilter, setAdminFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const isManager = sessionUser?.adminRole === "manager";

  const filteredRows = useMemo(() => {
    let list = rows;
    if (adminFilter) list = list.filter((r) => r.assigned_admin_id === adminFilter);
    if (statusFilter) list = list.filter((r) => r.status === statusFilter || r.hiring_stage === statusFilter);
    if (dateFrom) list = list.filter((r) => r.updated_at >= dateFrom);
    if (dateTo) list = list.filter((r) => r.updated_at <= `${dateTo}T23:59:59`);
    return list;
  }, [rows, adminFilter, statusFilter, dateFrom, dateTo]);

  const statuses = useMemo(() => [...new Set(rows.map((r) => r.status))], [rows]);

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
      {isManager ? (
        <div className="card-body admin-chat-filters">
          <div className="form-row">
            <div className="form-group">
              <label>Assigned admin</label>
              <select value={adminFilter} onChange={(e) => setAdminFilter(e.target.value)}>
                <option value="">All admins</option>
                {admins.filter((a) => a.admin_role === "admin").map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Status / stage</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All</option>
                {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>From</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="form-group">
              <label>To</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
        </div>
      ) : null}
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
            ) : filteredRows.length === 0 ? (
              <tr><td colSpan={8} className="t-secondary">No ongoing deals</td></tr>
            ) : (
              filteredRows.map((r) => (
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
