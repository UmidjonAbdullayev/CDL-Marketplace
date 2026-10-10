import { AlertTriangle } from "lucide-react";
import { useCarrierOffersReminder } from "../../context/CarrierOffersReminderContext";

/** Flying triangle from banner → topbar after dismiss. */
export function CarrierOffersFlyIcon() {
  const { fly } = useCarrierOffersReminder();
  if (!fly.active || !fly.from || !fly.to) return null;

  const dx = fly.to.x - fly.from.x;
  const dy = fly.to.y - fly.from.y;

  return (
    <div
      className="carrier-offers-fly-icon"
      style={
        {
          "--fly-x": `${fly.from.x}px`,
          "--fly-y": `${fly.from.y}px`,
          "--fly-dx": `${dx}px`,
          "--fly-dy": `${dy}px`,
          "--fly-size": `${Math.max(fly.from.w, 28)}px`
        } as React.CSSProperties
      }
      aria-hidden
    >
      <AlertTriangle />
    </div>
  );
}
