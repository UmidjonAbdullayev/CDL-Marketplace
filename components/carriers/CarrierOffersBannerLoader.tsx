import { useCarrierOffersReminder } from "../../context/CarrierOffersReminderContext";
import type { SessionUser } from "../../lib/session";
import { CarrierOffersBanner } from "./CarrierOffersBanner";

/** App-wide / dashboard reminder — hideable into topbar via X. */
export function CarrierOffersBannerLoader({ sessionUser }: { sessionUser: SessionUser | null }) {
  const { showBanner, percent, dismissBanner } = useCarrierOffersReminder();

  if (!sessionUser || !showBanner) return null;

  return (
    <CarrierOffersBanner
      completion={{ isComplete: false, percent, missingRequired: [] }}
      compact
      dismissible
      onDismiss={(el) => dismissBanner(el)}
    />
  );
}
