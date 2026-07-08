import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { carrierOffersCompletion } from "../../lib/carrier-offers";
import type { CarrierOffersRequirements } from "../../types/carrier-offers";

type CarrierOffersBannerProps = {
  offers: CarrierOffersRequirements | null;
  compact?: boolean;
};

export function CarrierOffersBanner({ offers, compact }: CarrierOffersBannerProps) {
  const parsed = offers ?? {};
  const { isComplete, percent, missingRequired } = carrierOffersCompletion(parsed);
  if (isComplete) return null;

  return (
    <div className={`carrier-offers-banner card ${compact ? "carrier-offers-banner--compact" : ""}`}>
      <div className="carrier-offers-banner-icon">
        <AlertTriangle className="icon-md" />
      </div>
      <div className="carrier-offers-banner-body">
        <strong>Complete your Offers &amp; Requirements application</strong>
        <p className="t-caption t-secondary">
          Recruiters send drivers based on your pay programs, lanes, fleet details, and hiring requirements.
          {missingRequired.length ? ` Missing: ${missingRequired.slice(0, 3).map((k) => k.replace(/([A-Z])/g, " $1")).join(", ")}…` : ""}
        </p>
        <div className="carrier-offers-progress">
          <div className="carrier-offers-progress-track">
            <div className="carrier-offers-progress-fill" style={{ width: `${percent}%` }} />
          </div>
          <span className="t-caption">{percent}% complete</span>
        </div>
      </div>
      <Link to="/profile?tab=offers" className="btn btn-primary btn-sm">
        Fill out application
      </Link>
    </div>
  );
}

export function CarrierOffersIncompleteNote() {
  return (
    <div className="carrier-offers-incomplete-note">
      <AlertTriangle className="icon-sm" />
      <span>This carrier has not completed their offers &amp; requirements profile yet.</span>
    </div>
  );
}
