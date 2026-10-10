import { useRef } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Link } from "react-router-dom";
import { carrierOffersCompletion } from "../../lib/carrier-offers";
import type { CarrierOffersRequirements } from "../../types/carrier-offers";

type CompletionOverride = {
  isComplete: boolean;
  percent: number;
  missingRequired?: string[];
};

type CarrierOffersBannerProps = {
  offers?: CarrierOffersRequirements | null;
  completion?: CompletionOverride;
  compact?: boolean;
  dismissible?: boolean;
  onDismiss?: (bannerEl: HTMLElement | null) => void;
};

export function CarrierOffersBanner({
  offers,
  completion,
  compact,
  dismissible,
  onDismiss
}: CarrierOffersBannerProps) {
  const bannerRef = useRef<HTMLDivElement>(null);
  const parsed = offers ?? {};
  const { isComplete, percent, missingRequired } = completion ?? carrierOffersCompletion(parsed);
  if (isComplete) return null;

  return (
    <div
      ref={bannerRef}
      className={`carrier-offers-banner card ${compact ? "carrier-offers-banner--compact" : ""}`}
    >
      <div className="carrier-offers-banner-icon">
        <AlertTriangle className="icon-md" />
      </div>
      <div className="carrier-offers-banner-body">
        <strong>Complete your Offers &amp; Requirements application</strong>
        <p className="t-caption t-secondary">
          Recruiters send drivers based on your pay programs, lanes, fleet details, and hiring requirements.
          {missingRequired?.length
            ? ` Missing: ${missingRequired
                .slice(0, 3)
                .map((k) => k.replace(/([A-Z])/g, " $1"))
                .join(", ")}…`
            : ""}
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
      {dismissible ? (
        <button
          type="button"
          className="carrier-offers-banner-close"
          aria-label="Dismiss reminder"
          title="Move reminder to top bar"
          onClick={() => onDismiss?.(bannerRef.current)}
        >
          <X className="icon-sm" />
        </button>
      ) : null}
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
