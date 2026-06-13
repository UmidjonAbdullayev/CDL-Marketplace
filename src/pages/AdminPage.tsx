import { useState } from "react";
import { useApp } from "../context/AppContext";
import { useExchangeData } from "../context/ExchangeDataContext";
import { PageHeader, ScoreFlag } from "../lib/badges";
import { Check, HelpCircle } from "lucide-react";
import { Pagination } from "../components/ui/Pagination";
import { approveListing, DEFAULT_PAGE_SIZE, rejectListing } from "../services/marketplace";
import { invalidateDataViews } from "../lib/dataInvalidation";
import { AdminRegistrationReview } from "../components/registration/AdminRegistrationReview";

export default function AdminPage() {
  const { showToast } = useApp();
  const [tab, setTab] = useState("approvals");
  const {
    adminPage: page,
    setAdminPage: setPage,
    adminApprovals: approvals,
    adminTotal: total,
    adminTotalPages: totalPages,
    adminLoading: loading,
    adminRefreshing: refreshing,
    refreshAdmin
  } = useExchangeData();

  const pending = total;

  const approve = (id: number) => {
    void approveListing(id)
      .then(() => {
        invalidateDataViews(["admin", "marketplace", "dashboard", "my-listings"]);
        refreshAdmin(true);
        showToast("Listing approved and published", "success");
      })
      .catch(() => showToast("Failed to approve", "error"));
  };

  const reject = (id: number) => {
    void rejectListing(id)
      .then(() => {
        invalidateDataViews(["admin", "my-listings"]);
        refreshAdmin(true);
        showToast("Listing rejected — seller notified", "error");
      })
      .catch(() => showToast("Failed to reject", "error"));
  };

  return (
    <div className="page active">
      <PageHeader title="Admin Panel" desc="Platform management, moderation, and analytics." />
      <div className="stats-grid">
        <div className="stat-card"><div className="label">Platform Revenue (MTD)</div><div className="value">$18,420</div></div>
        <div className="stat-card"><div className="label">Pending Approvals</div><div className="value" id="pendingCount">{pending}</div></div>
        <div className="stat-card"><div className="label">Fraud Alerts</div><div className="value" style={{ color: "var(--red)" }}>3</div></div>
        <div className="stat-card"><div className="label">Active Users</div><div className="value">1,892</div></div>
      </div>
      {refreshing ? <div className="t-caption t-secondary" style={{ marginBottom: 8 }}>Updating...</div> : null}
      <div className="tabs" id="adminTabs">
        <button className={`tab ${tab === "approvals" ? "active" : ""}`} onClick={() => setTab("approvals")}>Listing Approvals</button>
        <button className={`tab ${tab === "registrations" ? "active" : ""}`} onClick={() => setTab("registrations")}>Registrations</button>
        <button className={`tab ${tab === "companies" ? "active" : ""}`} onClick={() => setTab("companies")}>Companies</button>
        <button className={`tab ${tab === "fees" ? "active" : ""}`} onClick={() => setTab("fees")}>Fees</button>
        <button className={`tab ${tab === "fraud" ? "active" : ""}`} onClick={() => setTab("fraud")}>Fraud Alerts</button>
      </div>
      <div className={`tab-panel ${tab === "approvals" ? "active" : ""}`}>
        <div className="card"><div className="table-wrap"><table><thead><tr><th>Listing</th><th>Seller</th><th>Price</th><th>Consent</th><th>Score</th><th>Actions</th></tr></thead><tbody>
          {loading && approvals.length === 0 ? (
            <tr><td colSpan={6} className="t-secondary">Loading approvals...</td></tr>
          ) : approvals.length === 0 ? (
            <tr><td colSpan={6} className="t-secondary">No pending approvals</td></tr>
          ) : approvals.map((r) => (
            <tr key={r.id} className="approval-row">
              <td>{r.listing}</td><td>{r.seller}</td><td>{r.price}</td>
              <td>{r.consent ? <span className="badge badge-green"><Check className="icon-sm" /></span> : <span className="badge badge-yellow"><HelpCircle className="icon-sm" /></span>}</td>
              <td><ScoreFlag score={r.score} /></td>
              <td>
                <button className="btn btn-success btn-sm" onClick={() => approve(r.id)}>Approve</button>
                <button className="btn btn-danger btn-sm" onClick={() => reject(r.id)}>Reject</button>
              </td>
            </tr>
          ))}
        </tbody></table></div></div>
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={DEFAULT_PAGE_SIZE} loading={loading || refreshing} onPageChange={setPage} />
      </div>
      <div className={`tab-panel ${tab === "registrations" ? "active" : ""}`}>
        <AdminRegistrationReview />
      </div>
      <div className={`tab-panel ${tab === "companies" ? "active" : ""}`}><div className="card"><div className="table-wrap"><table>
        <thead><tr><th>Company</th><th>Status</th><th>Leads Sold</th><th>Refund Rate</th><th>Actions</th></tr></thead>
        <tbody>
          <tr><td>Southern Recruiters LLC</td><td><span className="badge badge-green">Active</span></td><td>156</td><td>1.2%</td><td><button className="btn btn-ghost btn-sm" onClick={() => showToast("Company profile opened", "success")}>View</button></td></tr>
          <tr><td>QuickLead Brokers</td><td><span className="badge badge-yellow">Review</span></td><td>32</td><td>12%</td><td><button className="btn btn-ghost btn-sm" onClick={() => showToast("Suspension initiated", "error")}>Suspend</button></td></tr>
        </tbody>
      </table></div></div></div>
      <div className={`tab-panel ${tab === "fees" ? "active" : ""}`}><div className="card"><div className="card-body" style={{ fontSize: 13 }}>
        <p><strong>Platform Commission:</strong> 15% on completed sales</p>
        <p><strong>Reservation Fee:</strong> $25 (applied toward purchase)</p>
        <p><strong>Featured Listing:</strong> $25 / 7 days</p>
        <p><strong>CDL Score Badge:</strong> $10 per listing</p>
      </div></div></div>
      <div className={`tab-panel ${tab === "fraud" ? "active" : ""}`}><div className="card"><div className="table-wrap"><table>
        <thead><tr><th>Alert</th><th>Company</th><th>Type</th><th>Severity</th><th>Actions</th></tr></thead>
        <tbody>
          <tr><td>FA-201</td><td>QuickLead Brokers</td><td>High refund rate</td><td><span className="badge badge-red">High</span></td><td><button className="btn btn-ghost btn-sm" onClick={() => showToast("Investigation opened", "success")}>Investigate</button></td></tr>
          <tr><td>FA-198</td><td>East Coast Leads</td><td>Duplicate listings</td><td><span className="badge badge-yellow">Medium</span></td><td><button className="btn btn-ghost btn-sm" onClick={() => showToast("Investigation opened", "success")}>Investigate</button></td></tr>
        </tbody>
      </table></div></div></div>
    </div>
  );
}
