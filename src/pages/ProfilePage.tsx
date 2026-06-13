import { Award, ShieldCheck, Star } from "lucide-react";
import { PageHeader, ReviewStars, VerifiedBadge } from "../lib/badges";

export default function ProfilePage() {
  return (
    <div className="page active">
      <PageHeader title="Company / Recruiter Profile" desc="Your public seller profile and company details." />
      <div className="card"><div className="profile-header">
        <div className="profile-avatar">FS</div>
        <div style={{ flex: 1 }}><h3 className="t-section">FleetSource Agency</h3>
          <div style={{ display: "flex", gap: "var(--s2)", margin: "var(--s2) 0", flexWrap: "wrap" }}>
            <VerifiedBadge text="Verified Company" />
            <span className="badge badge-navy"><Award className="icon-sm" /> Trusted Seller</span>
            <span className="badge badge-blue"><ShieldCheck className="icon-sm" /> CDL Score Partner</span>
          </div>
          <div className="t-secondary">Dallas, TX · Member since Jan 2024 · DOT# 3847291</div>
        </div>
        <button className="btn btn-secondary">Edit Profile</button>
      </div>
      <div className="profile-stats" style={{ padding: "0 24px 24px" }}>
        <div className="profile-stat"><div className="num">4.8</div><div className="lbl" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}><Star className="icon-sm" style={{ color: "var(--warning)" }} /> Seller Rating</div></div>
        <div className="profile-stat"><div className="num">247</div><div className="lbl">Leads Sold</div></div>
        <div className="profile-stat"><div className="num">2.1%</div><div className="lbl">Refund Rate</div></div>
        <div className="profile-stat"><div className="num">1.4h</div><div className="lbl">Avg Response</div></div>
      </div></div>
      <div className="grid-2" style={{ marginTop: 20 }}>
        <div className="card"><div className="card-header"><h3>Reviews (48)</h3></div><div className="card-body">
          <div className="review-item"><ReviewStars filled={5} /><strong>RapidHaul Recruiting</strong> · Jun 3, 2026<p className="t-secondary" style={{ marginTop: "var(--s1)" }}>Excellent lead quality. Robert was exactly as described. Fast response time.</p></div>
          <div className="review-item"><ReviewStars filled={4} /><strong>Swift Logistics</strong> · May 28, 2026<p className="t-secondary" style={{ marginTop: "var(--s1)" }}>Good leads overall. One driver had outdated medical cert but seller resolved quickly.</p></div>
          <div className="review-item"><ReviewStars filled={5} /><strong>Desert Carriers</strong> · May 20, 2026<p className="t-secondary" style={{ marginTop: "var(--s1)" }}>Best lead vendor we've used. Consent docs always included. Highly recommend.</p></div>
        </div></div>
        <div className="card"><div className="card-header"><h3>Company Details</h3></div><div className="card-body" style={{ fontSize: 13, lineHeight: 2 }}>
          <strong>Company:</strong> FleetSource Agency LLC<br />
          <strong>MC#:</strong> MC-892471<br />
          <strong>Specialization:</strong> Class A OTR, Tanker, Hazmat<br />
          <strong>Service Area:</strong> Nationwide<br />
          <strong>Contact:</strong> recruiting@fleetsource.com<br />
          <strong>Website:</strong> www.fleetsource.com<br /><br />
          <strong>About:</strong> Premier CDL driver lead provider serving carriers and recruiters since 2019. All leads are consent-verified with CDL Score integration.
        </div></div>
      </div>
    </div>
  );
}
