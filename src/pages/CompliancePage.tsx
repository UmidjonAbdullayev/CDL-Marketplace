import { ComplianceCard, PageHeader } from "../lib/badges";

export default function CompliancePage() {
  return (
    <div className="page active">
      <PageHeader title="Compliance & Consent Center" desc="How CDL Exchange protects drivers, buyers, and sellers." />
      <div className="compliance-grid">
        <ComplianceCard icon="user-check" title="Driver Consent Required" text="Every listing must include verified driver consent before publication. Sellers must confirm the driver agreed to share information with potential employers." />
        <ComplianceCard icon="lock" title="Data Protected Until Purchase" text="Phone numbers, email addresses, CDL numbers, and documents are hidden from buyers until a lead is purchased. Only first name and last initial are shown." />
        <ComplianceCard icon="ban" title="No SSN Storage" text="CDL Exchange never stores Social Security Numbers. We are not a background check provider — integrate with CDL Score for full screening." />
        <ComplianceCard icon="calendar-off" title="No DOB Shown Publicly" text="Date of birth is never displayed on marketplace listings or public profiles. Age verification happens post-purchase through your hiring process." />
        <ComplianceCard icon="clipboard-list" title="Seller Accuracy Responsibility" text="Sellers are responsible for accurate driver information. Misrepresentation may result in refunds, account suspension, or permanent ban." />
        <ComplianceCard icon="search" title="Marketplace Audits" text="CDL Exchange reserves the right to audit listings, verify consent records, and request supporting documentation at any time." />
        <ComplianceCard icon="alert-triangle" title="Duplicate & Fake Lead Policy" text="Listing duplicate leads or fabricated driver profiles results in immediate suspension. Repeat violations lead to permanent bans and forfeiture of escrow funds." />
        <ComplianceCard icon="bar-chart-3" title="Consent Audit Logs" text="All consent confirmations are timestamped and stored. Admins can review consent audit trails in the Admin Panel." />
      </div>
      <div className="card" style={{ marginTop: 24 }}><div className="card-header"><h3>Recent Consent Audit Log</h3></div><div className="card-body"><table>
        <thead><tr><th>Listing</th><th>Seller</th><th>Consent Date</th><th>Method</th><th>Status</th></tr></thead>
        <tbody>
          <tr><td>Marcus J. — #1</td><td>FleetSource</td><td>Jun 1, 2026</td><td>Digital Signature</td><td><span className="badge badge-green">Verified</span></td></tr>
          <tr><td>Elena R. — #2</td><td>West Coast Leads</td><td>May 28, 2026</td><td>Verbal + Recorded</td><td><span className="badge badge-green">Verified</span></td></tr>
          <tr><td>Michael D. — #7</td><td>QuickLead Brokers</td><td>May 20, 2026</td><td>Digital Signature</td><td><span className="badge badge-yellow">Under Review</span></td></tr>
        </tbody>
      </table></div></div>
    </div>
  );
}
