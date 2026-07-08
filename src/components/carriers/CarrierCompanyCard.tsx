import { CheckCircle2, Star } from "lucide-react";
import {
  carrierEquipmentLabel,
  carrierInitials,
  carrierIsActive,
  formatMcNumber
} from "../../lib/carrier-filters";
import type { CarrierCard } from "../../types/carriers";

type CarrierCompanyCardProps = {
  carrier: CarrierCard;
  isRecruiter: boolean;
  onOpen: () => void;
};

function fleetLabel(fleetSize: string): string {
  const trimmed = fleetSize.trim();
  if (!trimmed) return "Fleet: —";
  if (/fleet/i.test(trimmed) || /truck/i.test(trimmed) || /\+/.test(trimmed)) return `Fleet: ${trimmed}`;
  return `Fleet: ${trimmed}+`;
}

export function CarrierCompanyCard({ carrier, isRecruiter, onOpen }: CarrierCompanyCardProps) {
  const active = carrierIsActive(carrier);
  const reviewCount = carrier.leadsPurchased > 0 ? carrier.leadsPurchased : null;

  return (
    <article className="carrier-company-card card">
      <div className="carrier-company-card-header">
        <div className="carrier-company-card-identity">
          <div className="carrier-company-card-avatar" aria-hidden>
            {carrierInitials(carrier.name)}
          </div>
          <div className="carrier-company-card-title-block">
            <h4>{carrier.name}</h4>
            <div className="carrier-company-card-subline">
              <span>{formatMcNumber(carrier.mcNumber)}</span>
              <span className="carrier-company-card-rating">
                <Star className="icon-sm" />
                {carrier.rating.toFixed(1)}
                {reviewCount != null ? ` (${reviewCount})` : ""}
              </span>
            </div>
          </div>
        </div>
        <div className="carrier-company-card-status">
          <span className="carrier-company-card-fleet">{fleetLabel(carrier.fleetSize)}</span>
          <span className={`carrier-company-card-active ${active ? "is-active" : ""}`}>
            <CheckCircle2 className="icon-sm" />
            {active ? "Active" : "Pending"}
          </span>
        </div>
      </div>

      <div className="carrier-company-card-grid">
        <div className="carrier-company-card-field">
          <div className="carrier-company-card-label">Equipment</div>
          <div className="carrier-company-card-value">{carrierEquipmentLabel(carrier)}</div>
        </div>
        <div className="carrier-company-card-field">
          <div className="carrier-company-card-label">Pay Range</div>
          <div className="carrier-company-card-value">{carrier.driverPayRange || "Contact for rates"}</div>
        </div>
        <div className="carrier-company-card-field">
          <div className="carrier-company-card-label">Home Time</div>
          <div className="carrier-company-card-value">{carrier.homeTimePolicy || "Not specified"}</div>
        </div>
        <div className="carrier-company-card-field">
          <div className="carrier-company-card-label">Location</div>
          <div className="carrier-company-card-value">
            {carrier.operatingRegions || carrier.serviceArea || carrier.state || "—"}
          </div>
        </div>
      </div>

      <div className="carrier-company-card-footer">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
        >
          {isRecruiter ? "Send Driver" : "View Company"}
        </button>
      </div>
    </article>
  );
}
