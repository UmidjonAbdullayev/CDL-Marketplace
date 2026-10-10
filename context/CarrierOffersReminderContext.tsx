import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { canActAsCarrier, isPlatformStaff } from "../lib/account-capabilities";
import { carrierOffersCompletion, emptyCarrierOffers } from "../lib/carrier-offers";
import { fetchCarrierOffersForAccount } from "../services/carrierProfile";
import type { SessionUser } from "../lib/session";

const DISMISS_KEY = "cdl-carrier-offers-banner-dismissed";

type FlyState = {
  active: boolean;
  from: { x: number; y: number; w: number; h: number } | null;
  to: { x: number; y: number } | null;
};

type CarrierOffersReminderContextValue = {
  incomplete: boolean;
  percent: number;
  dismissed: boolean;
  showBanner: boolean;
  showTopbarIcon: boolean;
  fly: FlyState;
  dismissBanner: (fromEl?: HTMLElement | null) => void;
  refreshOffers: () => Promise<void>;
};

const CarrierOffersReminderContext = createContext<CarrierOffersReminderContextValue | null>(null);

function readDismissed(accountId: string): boolean {
  try {
    return localStorage.getItem(`${DISMISS_KEY}:${accountId}`) === "1";
  } catch {
    return false;
  }
}

function writeDismissed(accountId: string, value: boolean) {
  try {
    const key = `${DISMISS_KEY}:${accountId}`;
    if (value) localStorage.setItem(key, "1");
    else localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function CarrierOffersReminderProvider({
  sessionUser,
  children
}: {
  sessionUser: SessionUser | null;
  children: ReactNode;
}) {
  const isCarrier =
    Boolean(sessionUser) &&
    sessionUser?.accountType === "carrier" &&
    canActAsCarrier(sessionUser) &&
    !isPlatformStaff(sessionUser);

  const [incomplete, setIncomplete] = useState(false);
  const [percent, setPercent] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [fly, setFly] = useState<FlyState>({ active: false, from: null, to: null });

  const refreshOffers = useCallback(async () => {
    if (!sessionUser?.id || !isCarrier) {
      setIncomplete(false);
      setPercent(0);
      return;
    }
    try {
      const offers = (await fetchCarrierOffersForAccount(sessionUser.id)) ?? emptyCarrierOffers();
      const { isComplete, percent: pct } = carrierOffersCompletion(offers);
      setIncomplete(!isComplete);
      setPercent(pct);
      if (isComplete) {
        writeDismissed(sessionUser.id, false);
        setDismissed(false);
      }
    } catch {
      setIncomplete(true);
      setPercent(0);
    }
  }, [sessionUser?.id, isCarrier]);

  useEffect(() => {
    if (!sessionUser?.id || !isCarrier) {
      setDismissed(false);
      setIncomplete(false);
      return;
    }
    setDismissed(readDismissed(sessionUser.id));
    void refreshOffers();
  }, [sessionUser?.id, isCarrier, refreshOffers]);

  // Re-check when returning to profile/offers (storage or focus)
  useEffect(() => {
    if (!isCarrier) return;
    const onFocus = () => void refreshOffers();
    window.addEventListener("focus", onFocus);
    const onCustom = () => void refreshOffers();
    window.addEventListener("carrier-offers-updated", onCustom);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("carrier-offers-updated", onCustom);
    };
  }, [isCarrier, refreshOffers]);

  const dismissBanner = useCallback(
    (fromEl?: HTMLElement | null) => {
      if (!sessionUser?.id) return;
      writeDismissed(sessionUser.id, true);
      setDismissed(true);

      const iconEl = fromEl?.querySelector(".carrier-offers-banner-icon") as HTMLElement | null;
      const startEl = iconEl ?? fromEl ?? null;
      const target =
        document.getElementById("carrier-offers-reminder-target") ??
        document.getElementById("notifBtn");
      if (!startEl || !target) {
        return;
      }

      const fromRect = startEl.getBoundingClientRect();
      const toRect = target.getBoundingClientRect();
      const aimLeft =
        target.id === "notifBtn" ? toRect.left - 42 : toRect.left + toRect.width / 2 - 14;
      const aimTop = toRect.top + toRect.height / 2 - 14;
      setFly({
        active: true,
        from: { x: fromRect.left, y: fromRect.top, w: fromRect.width, h: fromRect.height },
        to: { x: aimLeft, y: aimTop }
      });

      window.setTimeout(() => {
        setFly({ active: false, from: null, to: null });
      }, 650);
    },
    [sessionUser?.id]
  );

  const value = useMemo<CarrierOffersReminderContextValue>(
    () => ({
      incomplete,
      percent,
      dismissed,
      showBanner: isCarrier && incomplete && !dismissed,
      showTopbarIcon: isCarrier && incomplete && dismissed,
      fly,
      dismissBanner,
      refreshOffers
    }),
    [incomplete, percent, dismissed, isCarrier, fly, dismissBanner, refreshOffers]
  );

  return (
    <CarrierOffersReminderContext.Provider value={value}>
      {children}
    </CarrierOffersReminderContext.Provider>
  );
}

export function useCarrierOffersReminder() {
  const ctx = useContext(CarrierOffersReminderContext);
  if (!ctx) {
    return {
      incomplete: false,
      percent: 0,
      dismissed: false,
      showBanner: false,
      showTopbarIcon: false,
      fly: { active: false, from: null, to: null } as FlyState,
      dismissBanner: () => undefined,
      refreshOffers: async () => undefined
    };
  }
  return ctx;
}
