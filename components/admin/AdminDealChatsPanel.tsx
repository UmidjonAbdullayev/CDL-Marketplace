import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import {
  fetchAdminDealChatInbox,
  fetchPlatformAdmins,
  type AdminChatInboxRow,
  type PlatformAdmin
} from "../../services/platformAdmin";

type Props = {
  lane: "carrier" | "recruiter";
};

export function AdminDealChatsPanel({ lane }: Props) {
  const navigate = useNavigate();
  const { sessionUser, showToast } = useApp();
  const isManager = sessionUser?.adminRole === "manager";
  const [rows, setRows] = useState<AdminChatInboxRow[]>([]);
  const [admins, setAdmins] = useState<PlatformAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminFilter, setAdminFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const channelType = lane === "carrier" ? "carrier_admin" : "recruiter_admin";

  const load = async () => {
    if (!sessionUser?.id) return;
    setLoading(true);
    try {
      const [inbox, adminList] = await Promise.all([
        fetchAdminDealChatInbox(sessionUser.id, sessionUser.adminRole ?? "admin", {
          adminId: adminFilter || undefined,
          status: statusFilter || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined
        }),
        isManager ? fetchPlatformAdmins() : Promise.resolve([] as PlatformAdmin[])
      ]);
      setRows(inbox.filter((r) => r.channel_type === channelType));
      setAdmins(adminList);
    } catch {
      showToast("Failed to load chat inbox", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [sessionUser?.id, sessionUser?.adminRole, adminFilter, statusFilter, dateFrom, dateTo, channelType]);

  const title = lane === "carrier" ? "Carrier ↔ Platform chats" : "Recruiter ↔ Platform chats";

  const statuses = useMemo(() => [...new Set(rows.map((r) => r.deal_status))], [rows]);

  return (
    <div className="card">
      <div className="card-header row">
        <h3>{title}</h3>
        <span className="t-caption t-secondary">Parties message the platform — admins coordinate both sides</span>
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
              <label>Deal status</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All statuses</option>
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
              <th>{lane === "carrier" ? "Carrier" : "Recruiter"}</th>
              <th>Status</th>
              <th>Stage</th>
              {isManager ? <th>Admin</th> : null}
              <th>Last activity</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={isManager ? 8 : 7} className="t-secondary">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={isManager ? 8 : 7} className="t-secondary">No active chats</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.conversation_id}>
                  <td>{r.deal_id}</td>
                  <td>{r.driver_label}</td>
                  <td>{r.party_name}</td>
                  <td>{r.deal_status}</td>
                  <td>{r.hiring_stage}</td>
                  {isManager ? <td>{r.assigned_admin_name}</td> : null}
                  <td>{r.last_message_at ? new Date(r.last_message_at).toLocaleString() : "—"}</td>
                  <td>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate(`/deals/${r.deal_id}?chat=${lane}`)}>
                      Open
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
