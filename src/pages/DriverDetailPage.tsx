import { ArrowLeft, ArrowRight, FileText, Info, Lock, ShieldCheck, UserCheck } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { useExchangeData } from "../context/ExchangeDataContext";
import { ScoreBadge, StarRating, VerifiedBadge } from "../lib/badges";
import { fmtDate, fmtRecruitingFee, fullName } from "../lib/format";

export default function DriverDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { sessionUser } = useApp();
  const { driverDetails, driverDetailLoading, loadDriverDetail } = useExchangeData();

  const listingId = Number(id);
  const driver = useMemo(() => (listingId ? driverDetails[listingId] ?? null : null), [driverDetails, listingId]);
  const canStartHiring = sessionUser?.accountType === "carrier";

  useEffect(() => {
    if (listingId) void loadDriverDetail(listingId);
  }, [listingId, loadDriverDetail]);

  if ((driverDetailLoading && !driver) || !driver) {
    return <div className="page active"><p className="t-secondary">Loading driver profile...</p></div>;
  }

  return (
    <div className="page active">
      <div className="page-header inline">
        <button className="btn btn-secondary btn-sm" onClick={() => navigate("/marketplace")}><ArrowLeft className="icon-sm" /> Back</button>
        <div><h2>Driver Profile</h2><p>{fullName(driver)} · {driver.state} · {driver.cdl}</p></div>
      </div>
      <div className="detail-layout revealed" id="detailPage">
        <div className="detail-main card">
          <div className="card-body">
            <div style={{ display: "flex", gap: "var(--s3)", flexWrap: "wrap", alignItems: "center" }}>
              <ScoreBadge score={driver.score} />
              {driver.verified ? <VerifiedBadge text="Verified Listing" /> : null}
              <span className="badge badge-green"><ShieldCheck className="icon-sm" /> Consent Verified</span>
              <span className="badge badge-purple"><FileText className="icon-sm" /> Documents Available</span>
            </div>
            <div className="info-grid">
              <div className="info-item"><div className="lbl">Full Name</div><div className="val">{fullName(driver)}</div></div>
              <div className="info-item"><div className="lbl">Experience</div><div className="val">{driver.exp} years</div></div>
              <div className="info-item"><div className="lbl">State</div><div className="val">{driver.state}</div></div>
              <div className="info-item"><div className="lbl">CDL Class</div><div className="val">{driver.cdl}</div></div>
              <div className="info-item"><div className="lbl">Equipment</div><div className="val">{driver.equip}</div></div>
              <div className="info-item"><div className="lbl">Endorsements</div><div className="val">{driver.endorse.length ? driver.endorse.join(", ") : "None"}</div></div>
              <div className="info-item"><div className="lbl">Availability</div><div className="val">{fmtDate(driver.avail)}</div></div>
            </div>
            <div style={{ marginTop: "var(--s5)", padding: "var(--s4)", background: "var(--blue-light)", borderRadius: "var(--radius-btn)", border: "1px solid var(--border)" }} className="t-secondary">
              <span style={{ display: "flex", alignItems: "flex-start", gap: "var(--s2)" }}>
                <UserCheck className="icon-md" style={{ flexShrink: 0, marginTop: 2 }} />
                <span>
                  Contact details and documents are shared through the hiring workspace after both parties sign
                  the platform recruiting agreement. CDL Exchange facilitates recruiting — not the sale of drivers.
                </span>
              </span>
            </div>
            <div style={{ marginTop: "var(--s5)" }}>
              <h4 className="t-card" style={{ marginBottom: "var(--s3)" }}>CDL Score Summary</h4>
              <div className="score-summary">
                <div className="score-ring"><ScoreBadge score={driver.score} /></div>
                <div className="score-details t-secondary">
                  <p>Full CDL Score report available during the hiring process. Includes MVR, PSP, and safety event history.</p>
                  <button className="btn btn-ghost btn-sm" onClick={() => navigate("/compliance")}>Learn about CDL Score</button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="detail-sidebar">
          <div className="card">
            <div className="card-body">
              <div className="lbl" style={{ fontSize: 11, color: "var(--gray-500)", textTransform: "uppercase", marginBottom: 4 }}>Platform Recruiting Fee</div>
              <div className="detail-price">{fmtRecruitingFee(driver.price)}</div>
              <p className="t-caption t-secondary" style={{ marginBottom: 12 }}>Fee for recruiting coordination through CDL Exchange</p>
              <div className="detail-seller"><StarRating rating={driver.sellerRating} /> {driver.seller}</div>
              {canStartHiring ? (
                <button
                  className="btn btn-primary btn-block"
                  style={{ marginTop: 16 }}
                  onClick={() => navigate(`/hiring/contract/${driver.id}`)}
                >
                  Start Hiring Process
                </button>
              ) : (
                <div className="action-locked-wrap" style={{ marginTop: 16 }}>
                  <button type="button" className="btn btn-primary btn-block action-locked-btn" disabled aria-disabled="true">
                    <Lock className="icon-sm" />
                    Start Hiring Process
                  </button>
                  <div className="action-locked-callout">
                    <Info className="icon-sm action-locked-icon" aria-hidden="true" />
                    <div>
                      <strong>Not available for recruiter accounts</strong>
                      <p>
                        Only carrier / company accounts can start hiring and purchase leads. As a recruiter you can
                        list drivers, manage ongoing deals, and chat with carriers in deal workspaces.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <div className="escrow-note t-caption t-secondary">Review and sign the recruiting agreement before messaging or document exchange.</div>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><h3>Listing Details</h3></div>
            <div className="card-body t-secondary" style={{ fontSize: 13, lineHeight: 1.8 }}>
              <div>Listed by verified seller</div>
              <div>Consent documentation on file</div>
              <div>Escrow protection included</div>
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => navigate("/ongoing-deals")}>
                View Ongoing Deals <ArrowRight className="icon-sm" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
