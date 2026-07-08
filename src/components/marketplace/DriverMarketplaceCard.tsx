import {
  Bookmark,
  CreditCard,
  FileText,
  MapPin,
  Send,
  Star,
  Truck,
  User
} from "lucide-react";
import { driverInitials, fmtPostedAt, maskName } from "../../lib/format";
import {
  driverAvatarColors,
  driverAvailabilityClass,
  driverAvailabilityLabel,
  driverCardBio,
  driverFooterTime,
  scoreToCdlScore
} from "../../lib/driver-card-display";
import type { DriverCard } from "../../types";

type DriverMarketplaceCardProps = {
  driver: DriverCard;
  saved: boolean;
  ownListing?: boolean;
  onOpen: () => void;
  onSave: () => void;
  onStartHiring: () => void;
  onInvoice: () => void;
};

export function DriverMarketplaceCard({
  driver,
  saved,
  ownListing,
  onOpen,
  onSave,
  onStartHiring,
  onInvoice
}: DriverMarketplaceCardProps) {
  const { bg, fg } = driverAvatarColors(driver.id);
  const endorsements = driver.equip ? [driver.equip] : [];

  return (
    <article
      className="driver-card-cdlone driver-card-clickable"
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`View profile for ${maskName(driver)}`}
    >
      {ownListing ? <div className="driver-card-own-tag">Your listing</div> : null}
      <div className="driver-card-body">
        <div className="driver-avatar-cdlone" style={{ background: bg, color: fg }}>
          {driverInitials(driver)}
        </div>
        <div className="driver-card-main">
          <div className="driver-header-badges">
            <span className="driver-name-cdlone">{maskName(driver)}</span>
            <span className="cdl-score-pill">
              <Star size={10} className="icon-star-score" />
              {scoreToCdlScore(driver.score)} CDLScore
            </span>
            {driver.verified ? (
              <span className="verified-pill-cdlone">
                <Star size={10} className="icon-star-primary" /> Verified
              </span>
            ) : null}
            <span className={`avail-pill ${driverAvailabilityClass(driver.avail)}`}>
              {driverAvailabilityLabel(driver.avail)}
            </span>
          </div>
          <div className="driver-meta-row">
            <span className="meta-tag-cdlone"><CreditCard size={12} /> {driver.cdl} CDL</span>
            <span className="meta-tag-cdlone"><Star size={12} /> {driver.expLabel} exp</span>
            <span className="meta-tag-cdlone"><MapPin size={12} /> {driver.state}</span>
            {endorsements.length ? (
              <span className="meta-tag-cdlone">
                <Truck size={12} /> {endorsements.join(" · ")}
              </span>
            ) : null}
          </div>
          <p className="driver-desc-cdlone">{driverCardBio(driver)}</p>
        </div>
      </div>
      <footer className="driver-card-footer">
        <div className="driver-card-footer-meta">
          <User size={13} />
          <span>
            Posted by <strong>{driver.seller}</strong>
            {" · "}
            {driverFooterTime(driver.createdAt) || fmtPostedAt(driver.createdAt).replace(/^Posted\s/, "")}
          </span>
        </div>
        <div className="driver-card-footer-btns">
          <button
            type="button"
            className={`driver-footer-btn driver-footer-save ${saved ? "saved" : ""}`}
            onClick={(e) => { e.stopPropagation(); onSave(); }}
          >
            <Bookmark size={14} fill={saved ? "currentColor" : "none"} /> Save
          </button>
          <button
            type="button"
            className="driver-footer-btn driver-footer-invoice"
            onClick={(e) => { e.stopPropagation(); onInvoice(); }}
          >
            <FileText size={14} /> Invoice
          </button>
          <button
            type="button"
            className="driver-footer-btn driver-footer-offer"
            onClick={(e) => { e.stopPropagation(); onStartHiring(); }}
          >
            <Send size={14} /> Start hiring
          </button>
        </div>
      </footer>
    </article>
  );
}
