import { useState } from "react";
import { useApp } from "../context/AppContext";

export default function PricingPage() {
  const { showToast } = useApp();
  const [annual, setAnnual] = useState(false);

  return (
    <div className="page active">
      <div className="page-header centered"><h2>Pricing & Billing</h2><p>Transparent marketplace pricing. Free to browse, pay only when you buy.</p></div>
      <div className="pricing-toggle">
        <span>Monthly</span>
        <div className={`toggle-track ${annual ? "annual" : ""}`} id="pricingToggle" onClick={() => setAnnual((v) => !v)}><div className="toggle-thumb" /></div>
        <span>Annual <span className="badge badge-green">Save 20%</span></span>
      </div>
      <div className="pricing-grid">
        <div className="pricing-card"><h3>Free</h3><div className="price">$0</div><div className="period">Browse only</div>
          <ul><li>Browse marketplace listings</li><li>View driver summaries</li><li>Filter & search drivers</li><li>Basic seller profiles</li></ul>
          <button className="btn btn-secondary" style={{ width: "100%" }}>Current Plan</button></div>
        <div className="pricing-card featured"><h3>Pro Marketplace</h3><div className="price" id="proPrice">{annual ? "$79" : "$99"}</div><div className="period" id="proPeriod">{annual ? "/month (billed annually)" : "/month"}</div>
          <ul><li>Unlimited lead purchases</li><li>Priority escrow processing</li><li>CRM export integration</li><li>Advanced CDL Score data</li><li>Bulk reserve (up to 5)</li><li>Priority support</li></ul>
          <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => showToast("Upgraded to Pro (demo)", "success")}>Upgrade to Pro</button></div>
        <div className="pricing-card"><h3>Enterprise</h3><div className="price">Custom</div><div className="period">Contact sales</div>
          <ul><li>Volume pricing discounts</li><li>API access</li><li>Custom escrow terms</li><li>Dedicated account manager</li><li>White-label options</li><li>SLA guarantees</li></ul>
          <button className="btn btn-secondary" style={{ width: "100%" }} onClick={() => showToast("Sales team will contact you", "success")}>Contact Sales</button></div>
      </div>
      <div className="card" style={{ marginTop: 32 }}><div className="card-header"><h3>Marketplace Fees</h3></div><div className="card-body"><table>
        <thead><tr><th>Fee Type</th><th>Amount</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td>Sale Commission</td><td><strong>15%</strong></td><td>Deducted from seller payout on completed deals</td></tr>
          <tr><td>Featured Listing</td><td><strong>$25</strong></td><td>Top placement in marketplace for 7 days</td></tr>
          <tr><td>CDL Score Verified Badge</td><td><strong>$10</strong></td><td>Per listing — shows verified safety score</td></tr>
          <tr><td>Lead Purchase</td><td><strong>Listing price</strong></td><td>Set by seller, typically $150–$600</td></tr>
        </tbody>
      </table></div></div>
      <div className="card" style={{ marginTop: 20 }}><div className="card-header"><h3>Billing History</h3></div><div className="card-body"><table>
        <thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Status</th></tr></thead>
        <tbody>
          <tr><td>Jun 1, 2026</td><td>Pro Marketplace — Monthly</td><td>$99.00</td><td><span className="badge badge-green">Paid</span></td></tr>
          <tr><td>May 28, 2026</td><td>Lead Purchase — Kevin B.</td><td>$425.00</td><td><span className="badge badge-green">Paid</span></td></tr>
          <tr><td>May 15, 2026</td><td>Lead Purchase — Sarah A.</td><td>$310.00</td><td><span className="badge badge-green">Paid</span></td></tr>
        </tbody>
      </table></div></div>
    </div>
  );
}
