import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  Bookmark,
  Calendar,
  CalendarCheck,
  Car,
  CheckCircle2,
  Clock,
  DollarSign,
  Eye,
  Home,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  Route,
  Send,
  Shield,
  Star,
  Truck
} from "lucide-react";
import { useExchangeData } from "../../context/ExchangeDataContext";
import { canStartHiring } from "../../lib/account-capabilities";
import { driverInitials, fmtDate, fmtRecruitingFee, maskName } from "../../lib/format";
import {
  driverAvailabilityLabel,
  driverCardBio,
  scoreToCdlScore
} from "../../lib/driver-card-display";
import { isCarrierMarketplaceVerified, marketplaceDisplayFee, shouldShowMarketplacePrice } from "../../lib/marketplace-display";
import { registerReturnPath } from "../../lib/public-routes";
import type { DriverCard } from "../../types";
import type { SessionUser } from "../../lib/session";

type ProfileTab = "overview" | "documents" | "history" | "endorsements" | "notes";

const TABS: { key: ProfileTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "documents", label: "Documents" },
  { key: "history", label: "Driving History" },
  { key: "endorsements", label: "Endorsements" },
  { key: "notes", label: "Notes" }
];

function expYearsLabel(driver: DriverCard): string {
  if (driver.expYears) return `${driver.expYears} years`;
  return driver.expLabel.replace(/\s*yrs?/i, " years");
}

export function DriverProfileModal({
  driver,
  saved,
  sessionUser,
  onClose,
  onSave
}: {
  driver: DriverCard;
  saved: boolean;
  sessionUser: SessionUser | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const navigate = useNavigate();
  const { loadDriverDetail, driverDetails } = useExchangeData();
  const [tab, setTab] = useState<ProfileTab>("overview");

  const detail = driverDetails[driver.id];
  const endorsements = detail?.endorse?.length ? detail.endorse : driver.equip ? [driver.equip] : [];
  const bio = detail?.notes?.trim() || driverCardBio(driver);
  const homeTime = driver.weeksOutPreference || "Flexible";
  const desiredPay = driver.desiredWeeklyPay || "Negotiable";
  const canSeePricing = shouldShowMarketplacePrice(sessionUser, driver);
  const fee = marketplaceDisplayFee(sessionUser, driver);
  const canHire =
    Boolean(sessionUser) && canStartHiring(sessionUser) && isCarrierMarketplaceVerified(sessionUser);

  useEffect(() => {
    void loadDriverDetail(driver.id);
  }, [driver.id, loadDriverDetail]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const startHiring = () => {
    onClose();
    if (!sessionUser) {
      navigate(`/register?intent=hire&returnTo=${encodeURIComponent(registerReturnPath("/marketplace"))}`);
      return;
    }
    navigate(`/hiring/contract/${driver.id}`);
  };

  const messageRecruiter = () => {
    onClose();
    navigate("/messages");
  };

  return (
    <div className="driver-profile-overlay" onClick={onClose} role="presentation">
      <div
        className="driver-profile-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${maskName(driver)} driver profile`}
      >
        <div className="dp-topbar">
          <button type="button" className="dp-back-link" onClick={onClose}>
            <ArrowLeft size={14} /> Back to marketplace
          </button>
          <button type="button" className="dp-menu-btn" aria-label="More options">
            <MoreHorizontal size={18} />
          </button>
        </div>

        <div className="dp-header">
          <div className="dp-header-main">
            <div className="dp-avatar">{driverInitials(driver)}</div>
            <div className="dp-identity">
              <div className="dp-name-row">
                <h2 className="dp-name">{maskName(driver)}</h2>
                <span className="dp-score-pill">
                  <Star size={11} className="icon-star-score" />
                  {scoreToCdlScore(driver.score)} CDL Score
                </span>
                {driver.verified ? (
                  <span className="dp-verified-pill">
                    <BadgeCheck size={11} /> Verified
                  </span>
                ) : null}
              </div>
              <div className="dp-meta-row">
                <span><Car size={13} /> {driver.cdl} CDL</span>
                <span><Shield size={13} /> {expYearsLabel(driver)} experience</span>
                <span><MapPin size={13} /> {driver.state}</span>
                {endorsements.map((e) => (
                  <span key={e}><Truck size={13} /> {e}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="dp-header-actions">
            <div className="dp-fee-block">
              <div className="dp-fee-label">Recruiter Fee</div>
              <div className="dp-fee-val">{canSeePricing ? fmtRecruitingFee(fee) : "—"}</div>
              <div className="dp-fee-sub">One-time placement fee</div>
            </div>
            <button type="button" className="dp-btn-hire" onClick={startHiring} disabled={!canHire && Boolean(sessionUser)}>
              Start Hiring Process
            </button>
            <div className="dp-header-btns">
              <button type="button" className="dp-btn-outline" onClick={startHiring}>
                <Send size={14} /> Start Hiring
              </button>
              <button type="button" className={`dp-btn-outline ${saved ? "saved" : ""}`} onClick={onSave}>
                <Bookmark size={14} fill={saved ? "currentColor" : "none"} /> Save Driver
              </button>
            </div>
          </div>
        </div>

        <div className="dp-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`dp-tab ${tab === t.key ? "active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="dp-content">
          {tab === "overview" ? (
            <div className="dp-overview-grid">
              <section className="dp-summary-card">
                <h3>Driver Summary</h3>
                <p className="dp-summary-bio">{bio}</p>
                <dl className="dp-summary-list">
                  <div className="dp-summary-item">
                    <dt><Calendar size={15} /> Experience</dt>
                    <dd>{expYearsLabel(driver)}</dd>
                  </div>
                  <div className="dp-summary-item">
                    <dt><Car size={15} /> CDL Class</dt>
                    <dd>{driver.cdl}</dd>
                  </div>
                  <div className="dp-summary-item">
                    <dt><Route size={15} /> Route Preference</dt>
                    <dd>{driver.companyExpectations ?? "OTR"}</dd>
                  </div>
                  <div className="dp-summary-item">
                    <dt><Truck size={15} /> Equipment</dt>
                    <dd>{driver.equip}</dd>
                  </div>
                  <div className="dp-summary-item">
                    <dt><Star size={15} /> Endorsements</dt>
                    <dd>{endorsements.length ? endorsements.join(", ") : "None listed"}</dd>
                  </div>
                  <div className="dp-summary-item">
                    <dt><CalendarCheck size={15} /> Availability</dt>
                    <dd className="dp-avail-green">{driverAvailabilityLabel(driver.avail)}</dd>
                  </div>
                  <div className="dp-summary-item">
                    <dt><Home size={15} /> Home Time</dt>
                    <dd>{homeTime}</dd>
                  </div>
                  <div className="dp-summary-item">
                    <dt><DollarSign size={15} /> Desired Pay</dt>
                    <dd>{desiredPay}</dd>
                  </div>
                </dl>
              </section>

              <aside className="dp-sidebar">
                <div className="dp-side-card">
                  <h4>Recruiter Info</h4>
                  <div className="dp-recruiter-head">
                    <div className="dp-recruiter-avatar">{driver.seller.slice(0, 2).toUpperCase()}</div>
                    <div>
                      <strong>{driver.seller}</strong>
                      <div className="dp-recruiter-stars">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star key={i} size={12} className="icon-star-score" />
                        ))}
                        <span>{driver.sellerRating.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                  {driver.sellerCompanyId ? (
                    <Link to={`/company/${driver.sellerCompanyId}/reviews`} className="dp-link" onClick={onClose}>
                      View Recruiter Profile
                    </Link>
                  ) : (
                    <button type="button" className="dp-link" onClick={onClose}>View Recruiter Profile</button>
                  )}
                </div>

                <div className="dp-side-card">
                  <h4>Actions</h4>
                  <div className="dp-action-btns">
                    <button type="button" className="dp-btn-hire" onClick={startHiring}>
                      Start Hiring Process
                    </button>
                    <button type="button" className={`dp-btn-outline ${saved ? "saved" : ""}`} onClick={onSave}>
                      <Bookmark size={14} fill={saved ? "currentColor" : "none"} /> Save Driver
                    </button>
                    <button type="button" className="dp-btn-outline" onClick={messageRecruiter}>
                      <MessageSquare size={14} /> Message Recruiter
                    </button>
                  </div>
                </div>
              </aside>
            </div>
          ) : (
            <div className="dp-tab-placeholder">
              <p>{TABS.find((t) => t.key === tab)?.label} content is available after starting the hiring process.</p>
            </div>
          )}
        </div>

        <footer className="dp-activity">
          <h4>Recent Activity</h4>
          <div className="dp-activity-row">
            <span className="dp-activity-item dp-activity-green">
              <CheckCircle2 size={14} /> Listed on {fmtDate(driver.createdAt)}
            </span>
            <span className="dp-activity-item dp-activity-green">
              <Eye size={14} /> {driver.driverType}
            </span>
            <span className="dp-activity-item dp-activity-orange">
              <Send size={14} /> {driver.state} · {driver.equip}
            </span>
            <span className="dp-activity-item dp-activity-orange">
              <Clock size={14} /> Avail {fmtDate(driver.avail)}
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
