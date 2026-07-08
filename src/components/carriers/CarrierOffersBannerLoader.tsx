import { useEffect, useState } from "react";
import { canActAsCarrier, isPlatformStaff } from "../../lib/account-capabilities";
import { emptyCarrierOffers } from "../../lib/carrier-offers";
import { fetchCarrierOffersForAccount } from "../../services/carrierProfile";
import type { SessionUser } from "../../lib/session";
import { CarrierOffersBanner } from "./CarrierOffersBanner";
import type { CarrierOffersRequirements } from "../../types/carrier-offers";

export function CarrierOffersBannerLoader({ sessionUser }: { sessionUser: SessionUser | null }) {
  const [offers, setOffers] = useState<CarrierOffersRequirements | null>(null);

  useEffect(() => {
    if (!sessionUser?.id || !canActAsCarrier(sessionUser) || isPlatformStaff(sessionUser)) {
      setOffers(null);
      return;
    }
    if (sessionUser.accountType !== "carrier") {
      setOffers(null);
      return;
    }
    void fetchCarrierOffersForAccount(sessionUser.id)
      .then((o) => setOffers(o ?? emptyCarrierOffers()))
      .catch(() => setOffers(emptyCarrierOffers()));
  }, [sessionUser?.id, sessionUser?.accountType]);

  if (!sessionUser || sessionUser.accountType !== "carrier" || isPlatformStaff(sessionUser)) return null;

  return (
    <div className="content-banner-wrap">
      <CarrierOffersBanner offers={offers} compact />
    </div>
  );
}
