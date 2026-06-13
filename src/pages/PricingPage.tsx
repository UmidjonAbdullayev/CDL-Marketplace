import { useEffect, useState } from "react";
import { useApp } from "../context/AppContext";
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

export default function PricingPage() {
  const { showToast } = useApp();
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
    <div className="page active">
      <div className="page-header centered">
        <h2>Pricing & Billing</h2>
        <p>Platform listing upgrades — no marketplace subscription fees.</p>
      </div>

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
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header"><h3>Billing History</h3></div>
          <div className="card-body">
            <table>
              <thead>
                <tr><th>Date</th><th>Description</th><th>Amount</th><th>Status</th></tr>
              </thead>
              <tbody>
                {billing.map((row) => (
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
      ) : null}
    </div>
  );
}
