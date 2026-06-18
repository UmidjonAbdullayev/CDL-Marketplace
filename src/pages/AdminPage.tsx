import { useState } from "react";
import { useApp } from "../context/AppContext";
import { AdminRegistrationReview } from "../components/registration/AdminRegistrationReview";
import { AdminDealChatsPanel } from "../components/admin/AdminDealChatsPanel";
import { AdminOngoingDealsPanel } from "../components/admin/AdminOngoingDealsPanel";
import { AdminTeamPanel } from "../components/admin/AdminTeamPanel";
import { ListingApprovalPanel } from "../components/admin/ListingApprovalPanel";
import { PageHeader } from "../lib/badges";

export default function AdminPage() {
  const { sessionUser } = useApp();
  const [tab, setTab] = useState("approvals");
  const isManager = sessionUser?.adminRole === "manager";

  return (
    <div className="page active admin-page">
      <PageHeader
        title={isManager ? "Platform Manager Console" : "Platform Admin Console"}
        desc={
          isManager
            ? "Review listings, set carrier pricing, assign cases, and manage your admin team."
            : "Work your assigned listing cases and registration reviews."
        }
      />

      <div className="admin-role-banner">
        <span className={`badge ${isManager ? "badge-purple" : "badge-blue"}`}>
          {isManager ? "Admin Manager" : "Platform Admin"}
        </span>
        <span className="t-secondary">{sessionUser?.email}</span>
      </div>

      <div className="tabs">
        <button type="button" className={`tab ${tab === "approvals" ? "active" : ""}`} onClick={() => setTab("approvals")}>Listing Cases</button>
        <button type="button" className={`tab ${tab === "deals" ? "active" : ""}`} onClick={() => setTab("deals")}>Ongoing Deals</button>
        <button type="button" className={`tab ${tab === "carrier-chats" ? "active" : ""}`} onClick={() => setTab("carrier-chats")}>Carrier Chats</button>
        <button type="button" className={`tab ${tab === "recruiter-chats" ? "active" : ""}`} onClick={() => setTab("recruiter-chats")}>Recruiter Chats</button>
        <button type="button" className={`tab ${tab === "registrations" ? "active" : ""}`} onClick={() => setTab("registrations")}>Registrations</button>
        {isManager ? (
          <button type="button" className={`tab ${tab === "team" ? "active" : ""}`} onClick={() => setTab("team")}>Admin Team</button>
        ) : null}
        <button type="button" className={`tab ${tab === "fees" ? "active" : ""}`} onClick={() => setTab("fees")}>Fee Policy</button>
      </div>

      <div className={`tab-panel ${tab === "approvals" ? "active" : ""}`}>
        <ListingApprovalPanel />
      </div>
      <div className={`tab-panel ${tab === "deals" ? "active" : ""}`}>
        <AdminOngoingDealsPanel />
      </div>
      <div className={`tab-panel ${tab === "carrier-chats" ? "active" : ""}`}>
        <AdminDealChatsPanel lane="carrier" />
      </div>
      <div className={`tab-panel ${tab === "recruiter-chats" ? "active" : ""}`}>
        <AdminDealChatsPanel lane="recruiter" />
      </div>
      <div className={`tab-panel ${tab === "registrations" ? "active" : ""}`}>
        <AdminRegistrationReview />
      </div>
      {isManager ? (
        <div className={`tab-panel ${tab === "team" ? "active" : ""}`}>
          <AdminTeamPanel />
        </div>
      ) : null}
      <div className={`tab-panel ${tab === "fees" ? "active" : ""}`}>
        <div className="card">
          <div className="card-body" style={{ fontSize: 13, lineHeight: 1.7 }}>
            <p><strong>Recruiter price caps:</strong> Company Driver $650 max · Team / Lease / Owner Operator $1,000 max</p>
            <p><strong>Platform fee:</strong> 15% deducted from recruiter listing price (shown as net payout to sellers)</p>
            <p><strong>Carrier pricing:</strong> List price + manager markup = final recruiting fee carriers pay</p>
            <p><strong>Contact protection:</strong> Carriers and recruiters never see each other&apos;s direct contact until both sign the platform agreement</p>
          </div>
        </div>
      </div>
    </div>
  );
}
