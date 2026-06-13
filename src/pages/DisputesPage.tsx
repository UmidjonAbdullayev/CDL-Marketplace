import { useApp } from "../context/AppContext";
import { useExchangeData } from "../context/ExchangeDataContext";
import { PageHeader } from "../lib/badges";
import { Pagination } from "../components/ui/Pagination";
import { DEFAULT_PAGE_SIZE, resolveDispute } from "../services/marketplace";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function DisputesPage() {
  const { openDisputeModal, showToast } = useApp();
  const {
    disputesPage: page,
    setDisputesPage: setPage,
    disputes: rows,
    disputesTotal: total,
    disputesTotalPages: totalPages,
    disputesLoading: loading,
    disputesRefreshing: refreshing,
    refreshDisputes
  } = useExchangeData();

  const resolve = (id: string, resolution: string) => {
    void resolveDispute(id, resolution)
      .then(() => {
        refreshDisputes(true);
        showToast(`Dispute resolved: ${resolution}`, "success");
      })
      .catch(() => showToast("Failed to resolve dispute", "error"));
  };

  return (
    <div className="page active">
      <PageHeader
        row
        title="Dispute Center"
        desc="File and manage disputes for purchased driver leads."
        actions={<button className="btn btn-primary" onClick={() => { openDisputeModal(); window.setTimeout(() => refreshDisputes(true), 500); }}>Open Dispute</button>}
      />
      {refreshing ? <div className="t-caption t-secondary" style={{ marginBottom: 8 }}>Updating...</div> : null}
      <div className="card"><div className="table-wrap"><table><thead><tr><th>Dispute ID</th><th>Deal</th><th>Reason</th><th>Filed By</th><th>Date</th><th>Admin Status</th><th>Resolution</th><th>Actions</th></tr></thead><tbody>
        {loading && rows.length === 0 ? (
          <tr><td colSpan={8} className="t-secondary">Loading disputes...</td></tr>
        ) : null}
        {!loading && rows.length === 0 ? (
          <tr><td colSpan={8} className="t-secondary">No disputes filed.</td></tr>
        ) : null}
        {rows.map((r) => (
          <tr key={r.id} id={r.id.toLowerCase()}>
            <td>{r.id}</td><td>{r.deal_id}</td><td>{r.reason}</td>
            <td>{r.companies?.name ?? "—"}</td><td>{formatDate(r.filed_at)}</td>
            <td><span className={`badge ${r.admin_status === "Resolved" ? "badge-green" : "badge-yellow"} admin-status`}>{r.admin_status}</span></td>
            <td><span className={`badge ${r.resolution === "Pending" ? "badge-gray" : "badge-green"} resolution-status`}>{r.resolution}</span></td>
            <td>
              {r.admin_status !== "Resolved" ? (
                <>
                  <button className="btn btn-ghost btn-sm" onClick={() => resolve(r.id, "Refund buyer")}>Refund</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => resolve(r.id, "Release seller payment")}>Release</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => resolve(r.id, "Partial refund")}>Partial Refund</button>
                </>
              ) : "—"}
            </td>
          </tr>
        ))}
      </tbody></table></div></div>
      <Pagination page={page} totalPages={totalPages} total={total} pageSize={DEFAULT_PAGE_SIZE} loading={loading || refreshing} onPageChange={setPage} />
      <div className="card" style={{ marginTop: 20 }}><div className="card-header"><h3>Dispute Process</h3></div><div className="card-body" style={{ fontSize: 13, color: "var(--gray-700)" }}>
        <p>1. Buyer files dispute within 72 hours of contact release · 2. Upload evidence (screenshots, call logs) · 3. Admin reviews within 48 business hours · 4. Resolution: full refund, partial refund, release payment, or ban seller</p>
      </div></div>
    </div>
  );
}
