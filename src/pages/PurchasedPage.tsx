import { Inbox } from "lucide-react";
import { Link } from "react-router-dom";
import { Pagination } from "../components/ui/Pagination";
import { useApp } from "../context/AppContext";
import { useExchangeData } from "../context/ExchangeDataContext";
import { PageHeader } from "../lib/badges";
import { fmtPrice } from "../lib/format";
import { DEFAULT_PAGE_SIZE, rowToCard, updatePurchase } from "../services/marketplace";

export default function PurchasedPage() {
  const { showToast } = useApp();
  const {
    purchasedPage: page,
    setPurchasedPage: setPage,
    purchasedRows: rows,
    purchasedTotal: total,
    purchasedTotalPages: totalPages,
    purchasedLoading: loading,
    purchasedRefreshing: refreshing,
    refreshPurchased
  } = useExchangeData();

  const showLoader = loading && rows.length === 0;

  const handleUpdate = (purchaseId: string, fields: Parameters<typeof updatePurchase>[1]) => {
    void updatePurchase(purchaseId, fields)
      .then(() => refreshPurchased(true))
      .catch(() => showToast("Failed to save", "error"));
  };

  return (
    <div className="page active">
      <PageHeader
        row
        title="Purchased Drivers"
        desc="Manage your purchased driver leads and track recruiting progress."
        actions={<button className="btn btn-secondary" onClick={() => showToast("CSV export started", "success")}>Export All</button>}
      />
      {refreshing ? <div className="t-caption t-secondary" style={{ marginBottom: 8 }}>Updating...</div> : null}
      <div className="card"><div className="table-wrap"><table>
        <thead><tr><th>Name</th><th>State</th><th>Equipment</th><th>Paid</th><th>Contact Status</th><th>Recruiting Status</th><th>Notes</th><th>Actions</th></tr></thead>
        <tbody>
          {showLoader ? (
            <tr><td colSpan={8} className="t-secondary">Loading purchases...</td></tr>
          ) : rows.length === 0 ? (
            <tr><td colSpan={8}><div className="empty-state"><div className="empty-icon"><Inbox /></div><p className="t-secondary">No purchased leads yet. <Link to="/marketplace">Browse the marketplace</Link> to buy your first driver lead.</p></div></td></tr>
          ) : (
            rows.map((p) => {
              const d = p.driver_listings ? rowToCard(p.driver_listings) : null;
              if (!d) return null;
              return (
                <tr key={p.id}>
                  <td>{d.first} {d.last}</td><td>{d.state}</td><td>{d.equip}</td><td>{fmtPrice(p.amount)}</td>
                  <td>
                    <select className="contact-status" value={p.contact_status} onChange={(e) => handleUpdate(p.id, { contact_status: e.target.value })}>
                      <option>Not Contacted</option><option>Contacted</option><option>In Progress</option>
                    </select>
                  </td>
                  <td>
                    <select className="recruit-status" value={p.recruit_status} onChange={(e) => handleUpdate(p.id, { recruit_status: e.target.value })}>
                      <option>Screening</option><option>Interview Scheduled</option><option>Orientation</option><option>Hired</option><option>Declined</option>
                    </select>
                  </td>
                  <td>
                    <input type="text" placeholder="Add note..." style={{ padding: "4px 8px", border: "1px solid var(--gray-200)", borderRadius: 4, width: 140 }} defaultValue={p.notes} onBlur={(e) => handleUpdate(p.id, { notes: e.target.value })} />
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => showToast("Exported to CDL Score CRM", "success")}>Export CRM</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => showToast("Opening CDL Score profile...", "success")}>CDL Score</button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table></div></div>
      <Pagination page={page} totalPages={totalPages} total={total} pageSize={DEFAULT_PAGE_SIZE} loading={loading || refreshing} onPageChange={setPage} />
    </div>
  );
}
