import { useNavigate } from "react-router-dom";
import { Pagination } from "../components/ui/Pagination";
import { PageHeader } from "../lib/badges";
import { useApp } from "../context/AppContext";
import { useExchangeData } from "../context/ExchangeDataContext";
import { DEFAULT_PAGE_SIZE, updateDealStatus, type DealRow } from "../services/marketplace";
import { fmtPrice } from "../lib/format";

const map: Record<string, { cls: string; txt: string }> = {
  Reserved: { cls: "badge-purple", txt: "Reserved" },
  "Contact Released": { cls: "badge-blue", txt: "Contact Released" },
  "Orientation Scheduled": { cls: "badge-blue", txt: "Orientation Scheduled" },
  "Orientation scheduled": { cls: "badge-blue", txt: "Orientation Scheduled" },
  "Hired Confirmed": { cls: "badge-green", txt: "Hired Confirmed" },
  Completed: { cls: "badge-gray", txt: "Completed" },
  Disputed: { cls: "badge-red", txt: "Disputed" },
  "Pending Payment": { cls: "badge-yellow", txt: "Pending Payment" }
};

function driverLabel(deal: DealRow) {
  const d = deal.driver_listings;
  return d ? `${d.first_name} ${d.last_name.charAt(0)}.` : "—";
}

export default function DealsPage() {
  const navigate = useNavigate();
  const { showToast } = useApp();
  const {
    dealsPage: page,
    setDealsPage: setPage,
    deals,
    dealsTotal: total,
    dealsTotalPages: totalPages,
    dealsStats: stats,
    dealsLoading: loading,
    dealsRefreshing: refreshing,
    refreshDeals
  } = useExchangeData();

  const advance = (id: string, status: string, escrowReleased = false) => {
    void updateDealStatus(id, status, escrowReleased)
      .then(() => {
        const txt = map[status]?.txt ?? status;
        showToast(`Deal updated: ${txt}`, "success");
        if (status === "Completed") showToast("Escrow released to seller", "success");
        refreshDeals(true);
      })
      .catch(() => showToast("Failed to update deal", "error"));
  };

  const escrowDisplay = (deal: DealRow) => {
    if (deal.escrow_released) return "Released";
    if (deal.escrow_amount > 0) return fmtPrice(deal.escrow_amount);
    return "-";
  };

  const actionFor = (deal: DealRow) => {
    if (deal.status === "Pending Payment") return <button className="btn btn-primary btn-sm" onClick={() => advance(deal.id, "Reserved")}>Pay Now</button>;
    if (deal.status === "Contact Released") return <button className="btn btn-ghost btn-sm" onClick={() => advance(deal.id, "Orientation Scheduled")}>Next Stage</button>;
    if (deal.status === "Hired Confirmed") return <button className="btn btn-success btn-sm" onClick={() => advance(deal.id, "Completed", true)}>Complete Deal</button>;
    if (deal.status === "Disputed") return <button className="btn btn-ghost btn-sm" onClick={() => navigate("/disputes")}>View Dispute</button>;
    return null;
  };

  return (
    <div className="page active">
      <PageHeader title="Deals / Escrow" desc="Track deal progress from payment through hire confirmation. Funds held securely in escrow." />
      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
        <div className="stat-card"><div className="label">In Escrow</div><div className="value">{fmtPrice(stats.inEscrow)}</div></div>
        <div className="stat-card"><div className="label">Pending Payment</div><div className="value">{stats.pendingPayment}</div></div>
        <div className="stat-card"><div className="label">Awaiting Confirmation</div><div className="value">{stats.awaiting}</div></div>
        <div className="stat-card"><div className="label">Completed (MTD)</div><div className="value">{stats.completed}</div></div>
      </div>
      {refreshing ? <div className="t-caption t-secondary" style={{ marginBottom: 8 }}>Updating...</div> : null}
      <div className="card"><div className="table-wrap"><table><thead><tr><th>Deal ID</th><th>Driver</th><th>Buyer</th><th>Seller</th><th>Amount</th><th>Status</th><th>Escrow</th><th>Actions</th></tr></thead><tbody>
        {loading && deals.length === 0 ? (
          <tr><td colSpan={8} className="t-secondary">Loading deals...</td></tr>
        ) : null}
        {!loading && deals.length === 0 ? (
          <tr><td colSpan={8} className="t-secondary">No deals yet. Start a hiring process from the marketplace.</td></tr>
        ) : null}
        {deals.map((d) => (
          <tr key={d.id} className="row-clickable" onClick={() => navigate(`/deals/${d.id}`)} style={{ cursor: "pointer" }}>
            <td>{d.id}</td><td>{driverLabel(d)}</td>
            <td>{d.companies_buyer?.name ?? "—"}</td>
            <td>{d.companies_seller?.name ?? "—"}</td>
            <td>{fmtPrice(d.amount)}</td>
            <td><span className={`badge ${map[d.status]?.cls ?? "badge-gray"} deal-status`}>{d.status}</span></td>
            <td>{escrowDisplay(d)}</td>
            <td onClick={(e) => e.stopPropagation()}>{actionFor(d) ?? "—"}</td>
          </tr>
        ))}
      </tbody></table></div></div>
      <Pagination page={page} totalPages={totalPages} total={total} pageSize={DEFAULT_PAGE_SIZE} loading={loading || refreshing} onPageChange={setPage} />
      <div className="grid-2" style={{ marginTop: 20 }}>
        <div className="card"><div className="card-header"><h3>Escrow Flow</h3></div><div className="card-body" style={{ fontSize: 13 }}>
          <div className="timeline">
            <div className="timeline-item done"><strong>1. Buyer Pays</strong><br />Payment captured via Stripe</div>
            <div className="timeline-item done"><strong>2. Funds Held in Escrow</strong><br />Secure hold until milestones met</div>
            <div className="timeline-item current"><strong>3. Contact Released</strong><br />Buyer receives full driver info</div>
            <div className="timeline-item"><strong>4. Orientation Scheduled</strong><br />Buyer confirms driver engagement</div>
            <div className="timeline-item"><strong>5. Hired Confirmed</strong><br />Driver starts employment</div>
            <div className="timeline-item"><strong>6. Seller Paid</strong><br />Escrow released minus 15% fee</div>
          </div>
        </div></div>
        <div className="card"><div className="card-header"><h3>Deal Status Legend</h3></div><div className="card-body" style={{ fontSize: 13, lineHeight: 2.2 }}>
          <span className="badge badge-yellow">Pending Payment</span> Awaiting buyer payment<br />
          <span className="badge badge-purple">Reserved</span> 48hr hold, not yet purchased<br />
          <span className="badge badge-blue">Contact Released</span> Lead delivered to buyer<br />
          <span className="badge badge-blue">Orientation Scheduled</span> Driver in hiring process<br />
          <span className="badge badge-green">Hired Confirmed</span> Employment verified<br />
          <span className="badge badge-gray">Completed</span> Escrow released to seller<br />
          <span className="badge badge-red">Disputed</span> Under admin review
        </div></div>
      </div>
    </div>
  );
}
