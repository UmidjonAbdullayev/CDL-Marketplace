import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { useExchangeData } from "../context/ExchangeDataContext";
import { AdminDealsCommandCenter } from "../components/admin/AdminDealsCommandCenter";
import { AdminRegistrationReview } from "../components/registration/AdminRegistrationReview";
import { AdminTeamPanel } from "../components/admin/AdminTeamPanel";
import { CompanyLimitsPanel } from "../components/admin/CompanyLimitsPanel";
import { ListingApprovalPanel } from "../components/admin/ListingApprovalPanel";
import { AdminWalletDepositsPanel } from "../components/admin/AdminWalletDepositsPanel";
import { AdminLeadsPanel } from "../components/admin/AdminLeadsPanel";
import { PageHeader } from "../lib/badges";

const VALID_TABS = new Set(["deals", "approvals", "registrations", "wallet", "limits", "team", "fees", "leads"]);

function TabBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return <span className="admin-tab-badge">{count > 99 ? "99+" : count}</span>;
}

export default function AdminPage() {
  const { sessionUser } = useApp();
  const { badges } = useExchangeData();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const initialTab = tabFromUrl && VALID_TABS.has(tabFromUrl) ? tabFromUrl : "deals";
  const [tab, setTab] = useState(initialTab);
  const isManager = sessionUser?.adminRole === "manager";
  const isDealsView = tab === "deals";

  useEffect(() => {
    if (tabFromUrl && VALID_TABS.has(tabFromUrl) && tabFromUrl !== tab) {
      setTab(tabFromUrl);
    }
  }, [tabFromUrl, tab]);

  const selectTab = useCallback(
    (next: string) => {
      setTab(next);
      if (next === "deals") {
        setSearchParams({}, { replace: true });
      } else {
        setSearchParams({ tab: next }, { replace: true });
      }
    },
    [setSearchParams]
  );

  const walletBadge = isManager ? badges.adminWalletDeposits : 0;
  const registrationPaymentBadge = isManager ? badges.adminCarrierPayments : 0;

  const pageDesc = useMemo(() => {
    if (!isManager) {
      return "Work your assigned listing cases and registration reviews.";
    }
    const parts: string[] = [];
    if (badges.adminPaymentApprovals > 0) {
      parts.push(`${badges.adminPaymentApprovals} payment approval(s) waiting`);
    }
    return parts.length
      ? `Review listings, set carrier pricing, assign cases, and manage your admin team. ${parts.join(" · ")}.`
      : "Review listings, set carrier pricing, assign cases, and manage your admin team.";
  }, [badges.adminPaymentApprovals, isManager]);

  return (
    <div className={`page active admin-page ${isDealsView ? "admin-page--deals" : ""}`}>
      {!isDealsView ? (
        <PageHeader
          title={isManager ? "Platform Manager Console" : "Platform Admin Console"}
          desc={pageDesc}
        />
      ) : null}

      {!isDealsView ? (
        <div className="admin-role-banner">
          <span className={`badge ${isManager ? "badge-purple" : "badge-blue"}`}>
            {isManager ? "Admin Manager" : "Platform Admin"}
          </span>
          <span className="t-secondary">{sessionUser?.email}</span>
          {isManager && badges.adminPaymentApprovals > 0 ? (
            <span className="badge badge-yellow admin-payment-pulse">
              {badges.adminPaymentApprovals} payment approval{badges.adminPaymentApprovals === 1 ? "" : "s"} pending
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="tabs admin-page-tabs">
        <button type="button" className={`tab ${tab === "deals" ? "active" : ""}`} onClick={() => selectTab("deals")}>Deals Workspace</button>
        <button type="button" className={`tab ${tab === "approvals" ? "active" : ""}`} onClick={() => selectTab("approvals")}>Listing Cases</button>
        <button type="button" className={`tab ${tab === "registrations" ? "active" : ""}`} onClick={() => selectTab("registrations")}>
          Registrations
          <TabBadge count={registrationPaymentBadge} />
        </button>
        {isManager ? (
          <button type="button" className={`tab ${tab === "wallet" ? "active" : ""}`} onClick={() => selectTab("wallet")}>
            Wallet Deposits
            <TabBadge count={walletBadge} />
          </button>
        ) : null}
        {isManager ? (
          <button type="button" className={`tab ${tab === "limits" ? "active" : ""}`} onClick={() => selectTab("limits")}>Trust Limits</button>
        ) : null}
        {isManager ? (
          <button type="button" className={`tab ${tab === "team" ? "active" : ""}`} onClick={() => selectTab("team")}>Admin Team</button>
        ) : null}
        <button type="button" className={`tab ${tab === "leads" ? "active" : ""}`} onClick={() => selectTab("leads")}>Leads</button>
        <button type="button" className={`tab ${tab === "fees" ? "active" : ""}`} onClick={() => selectTab("fees")}>Fee Policy</button>
      </div>

      <div className={`tab-panel ${tab === "deals" ? "active" : ""}`}>
        <AdminDealsCommandCenter />
      </div>
      <div className={`tab-panel ${tab === "approvals" ? "active" : ""}`}>
        <ListingApprovalPanel />
      </div>
      <div className={`tab-panel ${tab === "registrations" ? "active" : ""}`}>
        <AdminRegistrationReview />
      </div>
      {isManager ? (
        <div className={`tab-panel ${tab === "wallet" ? "active" : ""}`}>
          <AdminWalletDepositsPanel />
        </div>
      ) : null}
      {isManager ? (
        <div className={`tab-panel ${tab === "limits" ? "active" : ""}`}>
          <CompanyLimitsPanel />
        </div>
      ) : null}
      {isManager ? (
        <div className={`tab-panel ${tab === "team" ? "active" : ""}`}>
          <AdminTeamPanel />
        </div>
      ) : null}
      <div className={`tab-panel ${tab === "leads" ? "active" : ""}`}>
        <AdminLeadsPanel />
      </div>
      <div className={`tab-panel ${tab === "fees" ? "active" : ""}`}>
        <div className="card">
          <div className="card-body" style={{ fontSize: 13, lineHeight: 1.7 }}>
            <p><strong>Recruiter price caps:</strong> Company Driver $650 max · Team / Lease / Owner Operator $1,000 max</p>
            <p><strong>Platform fee:</strong> 15% deducted from recruiter listing price (shown as net payout to sellers)</p>
            <p><strong>Carrier pricing:</strong> List price + manager markup = final recruiting fee carriers pay</p>
            <p><strong>Contact protection:</strong> Carriers and recruiters coordinate through platform admins only</p>
          </div>
        </div>
      </div>
    </div>
  );
}
