import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
import { canActAsCarrier, isPlatformStaff } from "../lib/account-capabilities";
import { CARRIER_PLANS } from "../lib/carrier-plans";
import { fmtPrice } from "../lib/format";
import { isSupabaseConfigured } from "../lib/supabase";
import { fetchBillingHistory, type BillingRow } from "../services/compliance";

const FEATURED_FEE = 10;

const FEATURED_TERMS = [
  "Featured placement lasts 7 days from payment confirmation.",
  "One-time fee of $10 USD per listing — no recurring marketplace subscription.",
  "Featured listings appear with elevated placement in marketplace search and browse results.",
  "Fee is charged when you upgrade an active listing to featured status.",
  "Refunds are not issued if a listing is paused, sold, or removed before the 7-day window ends.",
  "CDL Exchange may remove featured status for policy violations without refund."
];

function FeaturedListingPricing({ showToast }: { showToast: (msg: string, type?: "" | "success" | "error") => void }) {
  const [billing, setBilling] = useState<BillingRow[]>([]);
  const [billingLoading, setBillingLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setBillingLoading(false);
      return;
    }
    void fetchBillingHistory()
      .then(setBilling)
      .catch(() => setBilling([]))
      .finally(() => setBillingLoading(false));
  }, []);

  return (
    <>
      <div className="pricing-grid" style={{ maxWidth: 480, margin: "0 auto" }}>
        <div className="pricing-card featured">
          <h3>Featured Listing</h3>
          <div className="price">{fmtPrice(FEATURED_FEE)}</div>
          <div className="period">per listing · 7 days</div>
          <ul>
            <li>Top placement in marketplace results</li>
            <li>Subtle featured styling on your listing card</li>
            <li>One-time payment — no auto-renew</li>
            <li>Available for active seller listings</li>
          </ul>
          <button
            className="btn btn-primary"
            style={{ width: "100%" }}
            type="button"
            onClick={() => showToast("Upgrade a listing from My Listings", "success")}
          >
            Upgrade a Listing
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 32 }}>
        <div className="card-header"><h3>Featured Listing Terms</h3></div>
        <div className="card-body" style={{ fontSize: 13, lineHeight: 1.7 }}>
          <ul style={{ paddingLeft: 20 }}>
            {FEATURED_TERMS.map((term) => (
              <li key={term} style={{ marginBottom: 8 }}>{term}</li>
            ))}
          </ul>
        </div>
      </div>

      {!billingLoading && billing.length > 0 ? (
        <BillingHistoryTable rows={billing} />
      ) : null}
    </>
  );
}

function BillingHistoryTable({ rows }: { rows: BillingRow[] }) {
  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div className="card-header"><h3>Billing History</h3></div>
      <div className="card-body">
        <table>
          <thead>
            <tr><th>Date</th><th>Description</th><th>Amount</th><th>Status</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{new Date(row.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                <td>{row.description}</td>
                <td>{fmtPrice(row.amount)}</td>
                <td><span className="badge badge-green">{row.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CarrierPlansPricing({
  currentPlanId,
  showToast
}: {
  currentPlanId: string;
  showToast: (msg: string, type?: "" | "success" | "error") => void;
}) {
  const [billing, setBilling] = useState<BillingRow[]>([]);
  const [billingLoading, setBillingLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setBillingLoading(false);
      return;
    }
    void fetchBillingHistory()
      .then(setBilling)
      .catch(() => setBilling([]))
      .finally(() => setBillingLoading(false));
  }, []);

  const currentPlan = CARRIER_PLANS.find((p) => p.id === currentPlanId) ?? CARRIER_PLANS[0];

  return (
    <>
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header"><h3>Your Current Plan</h3></div>
        <div className="card-body" style={{ fontSize: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <strong style={{ fontSize: 18 }}>{currentPlan.name}</strong>
              <div className="t-secondary" style={{ marginTop: 4 }}>{currentPlan.priceLabel}</div>
            </div>
            <span className="badge badge-blue">Active</span>
          </div>
          <ul style={{ marginTop: 16, paddingLeft: 20, lineHeight: 1.8, fontSize: 13 }}>
            {currentPlan.features.map((f) => (
              <li key={f.text} style={{ color: f.locked ? "var(--gray-400)" : undefined }}>
                {f.locked ? "🔒 " : "✓ "}{f.text}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="page-header centered" style={{ marginBottom: 24 }}>
        <h3>Available Plans</h3>
        <p className="t-secondary">Choose the plan that fits your hiring volume and CRM needs.</p>
      </div>

      <div className="pricing-grid">
        {CARRIER_PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          return (
            <div key={plan.id} className={`pricing-card ${plan.popular ? "featured" : ""} ${isCurrent ? "current-plan" : ""}`}>
              {plan.popular ? <div className="badge badge-blue" style={{ marginBottom: 8 }}>Most Popular</div> : null}
              {isCurrent ? <div className="badge badge-green" style={{ marginBottom: 8 }}>Current Plan</div> : null}
              <h3>{plan.name}</h3>
              <div className="price">{plan.price === 0 ? "$0" : fmtPrice(plan.price)}</div>
              <div className="period">{plan.price === 0 ? "Browse preview" : "/month"}</div>
              <ul>
                {plan.features.map((f) => (
                  <li key={f.text} style={{ color: f.locked ? "var(--gray-400)" : undefined }}>
                    {f.locked ? "— " : ""}{f.text}
                  </li>
                ))}
              </ul>
              <button
                className={`btn ${isCurrent ? "btn-secondary" : "btn-primary"}`}
                style={{ width: "100%" }}
                type="button"
                disabled={isCurrent}
                onClick={() => showToast(isCurrent ? "Already on this plan" : `Upgrade to ${plan.name} (demo)`, "success")}
              >
                {isCurrent ? "Current Plan" : `Upgrade to ${plan.name}`}
              </button>
            </div>
          );
        })}
      </div>

      {!billingLoading && billing.length > 0 ? (
        <BillingHistoryTable rows={billing} />
      ) : null}
    </>
  );
}

export default function PricingPage() {
  const { showToast, sessionUser } = useApp();
  const isCarrier = canActAsCarrier(sessionUser);
  const isStaff = isPlatformStaff(sessionUser);
  const currentPlanId = sessionUser?.selectedPlan ?? (isStaff ? "pro_fleet" : "free");

  return (
    <div className="page active">
      <div className="page-header centered">
        <h2>Pricing & Billing</h2>
        <p>
          {isCarrier
            ? isStaff
              ? "Platform operations account — full marketplace access included."
              : "Manage your carrier subscription and view billing history."
            : "Listing upgrades and billing for your recruiter account."}
        </p>
      </div>

      {isCarrier ? (
        <CarrierPlansPricing currentPlanId={currentPlanId} showToast={showToast} />
      ) : (
        <FeaturedListingPricing showToast={showToast} />
      )}
    </div>
  );
}
