import { useEffect, useState, useCallback } from "react";
import { ChevronRight, Handshake, User } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { useExchangeData } from "../context/ExchangeDataContext";
import { PageHeader } from "../lib/badges";
import { statusBadgeClass } from "../lib/hiring";
import { fmtRecruitingFee, fullName } from "../lib/format";
import { isPlatformStaff, canActAsCarrier } from "../lib/account-capabilities";
import { submissionStatusBadgeClass, submissionStatusLabel } from "../lib/driver-submissions";
import { isSupabaseConfigured } from "../lib/supabase";
import { fetchOngoingDeals, type HiringDealRow } from "../services/hiring";
import { fetchCarrierSubmissionsPage, type DriverSubmissionListItem } from "../services/driverSubmissions";
import { markOngoingDealsViewed } from "../services/dealViews";
import { usePlatformRealtime } from "../hooks/usePlatformRealtime";

function driverName(deal: HiringDealRow): string {
  const d = deal.driver_listings;
  return d ? fullName({ first: d.first_name, last: d.last_name }) : "Driver";
}

function partyRole(deal: HiringDealRow, companyId: string): "Buyer" | "Seller" {
  if (deal.buyer_company_id === companyId) return "Buyer";
  if (deal.seller_company_id === companyId) return "Seller";
  return "Buyer";
}

function nextAction(deal: HiringDealRow): string {
  if (deal.status === "Awaiting Seller Signature") return "Seller signature required";
  if (!deal.buyer_signed_at) return "Buyer contract pending";
  if (!deal.seller_signed_at) return "Awaiting seller signature";
  if (deal.hiring_stage === "screening") return "Screening in progress";
  if (deal.hiring_stage === "interview") return "Interview stage";
  if (deal.hiring_stage === "orientation") return "Orientation scheduled";
  if (deal.hiring_stage === "hired") return "Hire confirmed";
  return "Active hiring";
}

function dealFeeForParty(deal: HiringDealRow, companyId: string): number {
  if (deal.seller_company_id === companyId && deal.driver_listings?.price != null) {
    return deal.driver_listings.price;
  }
  return deal.amount;
}

export default function OngoingDealsPage() {
  const navigate = useNavigate();
  const { sessionUser } = useApp();
  const { refreshNotifications } = useExchangeData();
  const [deals, setDeals] = useState<HiringDealRow[]>([]);
  const [submissions, setSubmissions] = useState<DriverSubmissionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const companyId = sessionUser?.companyId ?? "";
  const platformWide = isPlatformStaff(sessionUser);
  const isCarrier = canActAsCarrier(sessionUser);

  useEffect(() => {
    void (async () => {
      try {
        if (isSupabaseConfigured && companyId) {
          const [dealRows, submissionRows] = await Promise.all([
            fetchOngoingDeals({ platformWide }),
            isCarrier ? fetchCarrierSubmissionsPage({ page: 1, pageSize: 20 }).then((r) => r.items) : Promise.resolve([])
          ]);
          setDeals(dealRows);
          setSubmissions(submissionRows);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [companyId, platformWide, isCarrier]);

  useEffect(() => {
    if (!companyId || loading || !deals.length) return;
    markOngoingDealsViewed(companyId, deals.map((d) => d.id));
    void refreshNotifications();
  }, [companyId, loading, deals, refreshNotifications]);

  const reloadDeals = useCallback(async () => {
    if (!isSupabaseConfigured || !companyId) return;
    try {
      const [dealRows, submissionRows] = await Promise.all([
        fetchOngoingDeals({ platformWide }),
        isCarrier ? fetchCarrierSubmissionsPage({ page: 1, pageSize: 20 }).then((r) => r.items) : Promise.resolve([])
      ]);
      setDeals(dealRows);
      setSubmissions(submissionRows);
    } catch {
      /* background refresh */
    }
  }, [companyId, platformWide, isCarrier]);

  usePlatformRealtime(
    useCallback((topics) => {
      if (topics.has("deals")) void reloadDeals();
    }, [reloadDeals]),
    Boolean(companyId)
  );

  return (
    <div className="page active">
      <PageHeader
        title="Ongoing Deals"
        desc="Track active recruiting engagements. Buyers and sellers share the same workspace for each hiring process."
      />

      {isCarrier && submissions.length > 0 ? (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 12 }}>Incoming driver submissions</h3>
          <p className="t-caption t-secondary" style={{ marginBottom: 12 }}>
            Drivers sent by recruiters — open a submission to review, update hiring status, and chat.
          </p>
          <div className="ongoing-deals-list">
            {submissions.map((sub) => (
              <button
                key={sub.id}
                type="button"
                className="ongoing-deal-row card"
                onClick={() => navigate(`/submissions/${sub.id}`)}
              >
                <div className="ongoing-deal-main">
                  <div className="ongoing-deal-avatar"><User className="icon-md" /></div>
                  <div className="ongoing-deal-info">
                    <div className="ongoing-deal-title">
                      {sub.driver_first_name} {sub.driver_last_name.charAt(0)}.
                    </div>
                    <div className="ongoing-deal-meta t-secondary">
                      {sub.driver_state} · {sub.driver_equipment} · from {sub.recruiter_name}
                    </div>
                  </div>
                </div>
                <div className="ongoing-deal-side">
                  <span className={`badge ${submissionStatusBadgeClass(sub.status)}`}>
                    {submissionStatusLabel(sub.status)}
                  </span>
                  {sub.status_comment ? (
                    <div className="t-caption t-secondary">{sub.status_comment}</div>
                  ) : null}
                </div>
                <ChevronRight className="icon-md ongoing-deal-chevron" />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="t-secondary">Loading ongoing deals...</p>
      ) : deals.length === 0 ? (
        <div className="empty-state card">
          <Handshake className="marketplace-empty-icon" />
          <h3>No ongoing deals</h3>
          <p className="t-secondary">
            Start a hiring process from a driver listing to open a recruiting agreement and workspace.
          </p>
          <Link to="/marketplace" className="btn btn-secondary btn-sm">Browse Marketplace</Link>
        </div>
      ) : (
        <div className="ongoing-deals-list">
          {deals.map((deal) => {
            const isSeller = deal.seller_company_id === companyId;
            const buyerPartyLabel = isSeller ? "Carrier" : (deal.companies_buyer?.name ?? "Buyer");
            const sellerPartyLabel = isSeller ? "Your listing" : (deal.companies_seller?.name ?? "Seller");
            return (
            <button
              key={deal.id}
              type="button"
              className="ongoing-deal-row card"
              onClick={() => navigate(`/deals/${deal.id}`)}
            >
              <div className="ongoing-deal-main">
                <div className="ongoing-deal-avatar"><User className="icon-md" /></div>
                <div className="ongoing-deal-info">
                  <div className="ongoing-deal-title">{driverName(deal)}</div>
                  <div className="ongoing-deal-meta t-secondary">
                    {deal.driver_listings?.state ?? "—"} · {deal.driver_listings?.equipment ?? "—"} ·{" "}
                    {deal.id}
                  </div>
                  <div className="ongoing-deal-parties t-caption t-secondary">
                    {buyerPartyLabel} ↔ {sellerPartyLabel}
                  </div>
                </div>
              </div>
              <div className="ongoing-deal-side">
                <span className={`badge ${statusBadgeClass(deal.status)}`}>{deal.status}</span>
                <span className="badge badge-gray">{partyRole(deal, companyId)}</span>
                <div className="ongoing-deal-fee">{fmtRecruitingFee(dealFeeForParty(deal, companyId))} {isSeller ? "listing price" : "recruiting fee"}</div>
                <div className="ongoing-deal-action t-caption">{nextAction(deal)}</div>
              </div>
              <ChevronRight className="icon-md ongoing-deal-chevron" />
            </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
