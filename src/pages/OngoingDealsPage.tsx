import { useEffect, useState } from "react";
import { ChevronRight, Handshake, User } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "../lib/badges";
import { DEMO_BUYER_ID, DEMO_SELLER_ID } from "../lib/constants";
import { statusBadgeClass } from "../lib/hiring";
import { fmtRecruitingFee, fullName } from "../lib/format";
import { isSupabaseConfigured } from "../lib/supabase";
import { fetchOngoingDeals, type HiringDealRow } from "../services/hiring";

function driverName(deal: HiringDealRow): string {
  const d = deal.driver_listings;
  return d ? fullName({ first: d.first_name, last: d.last_name }) : "Driver";
}

function partyRole(deal: HiringDealRow): "Buyer" | "Seller" {
  return deal.seller_company_id === DEMO_SELLER_ID && deal.buyer_company_id !== DEMO_BUYER_ID
    ? "Seller"
    : deal.buyer_company_id === DEMO_BUYER_ID
      ? "Buyer"
      : deal.seller_company_id === DEMO_SELLER_ID
        ? "Seller"
        : "Buyer";
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

export default function OngoingDealsPage() {
  const navigate = useNavigate();
  const [deals, setDeals] = useState<HiringDealRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        if (isSupabaseConfigured) {
          setDeals(await fetchOngoingDeals());
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="page active">
      <PageHeader
        title="Ongoing Deals"
        desc="Track active recruiting engagements. Buyers and sellers share the same workspace for each hiring process."
      />

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
          {deals.map((deal) => (
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
                    {deal.companies_buyer?.name ?? "Buyer"} ↔ {deal.companies_seller?.name ?? "Seller"}
                  </div>
                </div>
              </div>
              <div className="ongoing-deal-side">
                <span className={`badge ${statusBadgeClass(deal.status)}`}>{deal.status}</span>
                <span className="badge badge-gray">{partyRole(deal)}</span>
                <div className="ongoing-deal-fee">{fmtRecruitingFee(deal.amount)} recruiting fee</div>
                <div className="ongoing-deal-action t-caption">{nextAction(deal)}</div>
              </div>
              <ChevronRight className="icon-md ongoing-deal-chevron" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
