import { CheckCircle2, Star } from "lucide-react";
import { CarrierOffersIncompleteNote } from "../carriers/CarrierOffersBanner";
import { toCarrierCardDisplay } from "../../lib/carrier-display";
import { carrierIsActive } from "../../lib/carrier-filters";
import type { CarrierCard } from "../../types/carriers";

type CarrierMarketplaceCardProps = {
  carrier: CarrierCard;
  isRecruiter: boolean;
  onOpen: () => void;
  onSendDriver: () => void;
};

export function CarrierMarketplaceCard({
  carrier,
  isRecruiter,
  onOpen,
  onSendDriver
}: CarrierMarketplaceCardProps) {
  const display = toCarrierCardDisplay(carrier);
  const active = carrierIsActive(carrier);

  const extraSection = (() => {
    if (!carrier.offersRequirements?.customSections?.length) return null;
    const sec = carrier.offersRequirements.customSections.find((s) => s.header.trim() && s.body.trim());
    if (!sec) return null;
    return (
      <div className="carrier-card-extra-note">
        <strong>{sec.header}</strong>
        <span>{sec.body.length > 120 ? `${sec.body.slice(0, 120)}…` : sec.body}</span>
      </div>
    );
  })();

  return (
    <article
      className="carrier-card-cdlone carrier-card-clickable"
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`View ${carrier.name} carrier profile`}
    >
      <div className="carrier-card-top">
        <div className="carrier-avatar" style={{ background: display.avatarBg, color: display.avatarFg }}>
          {display.initials}
        </div>
        <div className="carrier-identity">
          <div className="carrier-name">{carrier.name}</div>
          <div className="carrier-sub-row">
            <span className="carrier-mc">{display.mcNumber}</span>
            <span className="carrier-rating">
              <Star size={12} className="icon-star-score" />
              {display.rating} ({display.reviewCount})
            </span>
          </div>
        </div>
        <div className="carrier-fleet">Fleet: {display.fleetSize}</div>
        <span className={`carrier-active-pill ${active ? "" : "is-pending"}`}>
          <CheckCircle2 size={12} /> {active ? "Active" : "Pending"}
        </span>
      </div>
      <div className="carrier-stats-grid">
        <div className="carrier-stat">
          <span className="carrier-stat-label">Equipment</span>
          <span className="carrier-stat-val">{display.equipment}</span>
        </div>
        <div className="carrier-stat">
          <span className="carrier-stat-label">Pay Range</span>
          <span className="carrier-stat-val">{display.payRange}</span>
        </div>
        <div className="carrier-stat">
          <span className="carrier-stat-label">Home Time</span>
          <span className="carrier-stat-val">{display.homeTime}</span>
        </div>
        <div className="carrier-stat">
          <span className="carrier-stat-label">Location</span>
          <span className="carrier-stat-val">{display.location}</span>
        </div>
      </div>
      <div className="carrier-card-action">
        {!carrier.offersComplete ? (
          <div className="carrier-card-incomplete-wrap" onClick={(e) => e.stopPropagation()}>
            <CarrierOffersIncompleteNote />
          </div>
        ) : null}
        {extraSection}
        <button
          type="button"
          className="carrier-send-btn"
          onClick={(e) => {
            e.stopPropagation();
            if (isRecruiter) onSendDriver();
            else onOpen();
          }}
        >
          {isRecruiter ? "Send Driver" : "View Company"}
        </button>
      </div>
    </article>
  );
}
