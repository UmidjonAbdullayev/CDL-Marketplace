import { useEffect } from "react";
import { isSellerNav } from "../lib/account-capabilities";
import {
  hasPendingOrderSounds,
  isOrderSoundUnlocked,
  playOrderNotificationSound,
  preloadOrderNotificationSound,
  unlockOrderNotificationSound
} from "../lib/orderNotificationSound";
import type { SessionUser } from "../lib/session";
import { supabase } from "../lib/supabase";

type DealRow = {
  id: string;
  seller_company_id: string;
  buyer_signed_at: string | null;
};

function isBuyerSigned(deal: DealRow): boolean {
  return Boolean(deal.buyer_signed_at);
}

/**
 * Unlocks order sounds after the first click/tap/keypress (required by browsers).
 */
export function useOrderSoundUnlock(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    preloadOrderNotificationSound();

    const unlock = () => {
      unlockOrderNotificationSound();
    };

    document.addEventListener("pointerdown", unlock, { passive: true });
    document.addEventListener("keydown", unlock);

    return () => {
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
    };
  }, [enabled]);
}

/**
 * Plays the Shopify order sound when a carrier signs a recruiting contract
 * on one of the recruiter's listings.
 */
export function useRecruiterOrderAlert(
  sessionUser: SessionUser | null,
  onNewOrder?: (dealId: string) => void
) {
  const isRecruiter = isSellerNav(sessionUser);
  const companyId = sessionUser?.companyId ?? "";

  useOrderSoundUnlock(isRecruiter);

  useEffect(() => {
    if (!isRecruiter || !companyId || !supabase) return;

    const notify = (dealId: string) => {
      playOrderNotificationSound(dealId);
      onNewOrder?.(dealId);
    };

    const onInsert = (payload: { new: DealRow }) => {
      const deal = payload.new;
      if (deal.seller_company_id !== companyId) return;
      if (isBuyerSigned(deal)) notify(deal.id);
    };

    const onUpdate = (payload: { old: DealRow; new: DealRow }) => {
      const prev = payload.old;
      const next = payload.new;
      if (next.seller_company_id !== companyId) return;
      if (!prev.buyer_signed_at && next.buyer_signed_at) {
        notify(next.id);
      }
    };

    const channel = supabase
      .channel(`recruiter-order-alert-${companyId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "deals",
          filter: `seller_company_id=eq.${companyId}`
        },
        (payload) => onInsert(payload as unknown as { new: DealRow })
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "deals",
          filter: `seller_company_id=eq.${companyId}`
        },
        (payload) => onUpdate(payload as unknown as { old: DealRow; new: DealRow })
      )
      .subscribe();

    return () => {
      if (supabase) void supabase.removeChannel(channel);
    };
  }, [isRecruiter, companyId, onNewOrder]);
}

export { hasPendingOrderSounds, isOrderSoundUnlocked };
