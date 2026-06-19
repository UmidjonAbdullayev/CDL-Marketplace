import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { invalidateDataViews } from "../lib/dataInvalidation";
import { fmtPrice, maskName } from "../lib/format";
import { setActiveCompanyId } from "../lib/activeCompany";
import {
  initSession,
  clearSession,
  writeSession,
  sessionFromAccount,
  type SessionUser
} from "../lib/session";
import { isSupabaseConfigured } from "../lib/supabase";
import { fetchCompanyById } from "../services/company";
import { buildSessionAccount, fetchRegistrationById } from "../services/registration";
import { DisputeForm } from "../components/DisputeForm";
import {
  fetchListingCardById,
  fetchPurchasedIds,
  fetchReservedIds,
  purchaseListing,
  reserveListing
} from "../services/marketplace";
import type { DriverCard } from "../types";

type ToastType = "" | "success" | "error";

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

export interface ModalState {
  open: boolean;
  title: string;
  body: ReactNode;
  footer?: ReactNode;
}

interface AppContextValue {
  purchased: Set<number>;
  reserved: Set<number>;
  dataReady: boolean;
  sessionUser: SessionUser | null;
  isSignedIn: boolean;
  signIn: (user: SessionUser) => void;
  signOut: () => void;
  toasts: ToastItem[];
  modal: ModalState;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  debouncedSearch: string;
  showToast: (message: string, type?: ToastType) => void;
  openModal: (title: string, body: ReactNode, footer?: ReactNode) => void;
  closeModal: () => void;
  refreshUserState: () => Promise<void>;
  buyDriver: (id: number, amount: number) => Promise<void>;
  reserveDriver: (id: number) => Promise<void>;
  openBuyModal: (id: number, onComplete?: () => void) => void;
  openReserveModal: (id: number, onComplete?: () => void) => void;
  openDisputeModal: (dealId?: string) => void;
  isPurchased: (id: number) => boolean;
  isReserved: (id: number) => boolean;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(() => initSession());
  const [purchased, setPurchased] = useState<Set<number>>(new Set());
  const [reserved, setReserved] = useState<Set<number>>(new Set());
  const [dataReady, setDataReady] = useState(!isSupabaseConfigured);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 100);
  const [modal, setModal] = useState<ModalState>({
    open: false,
    title: "",
    body: null,
    footer: null
  });

  const refreshUserState = useCallback(async () => {
    if (!sessionUser?.companyId) {
      setDataReady(true);
      setPurchased(new Set());
      setReserved(new Set());
      return;
    }
    setActiveCompanyId(sessionUser.companyId);
    if (!isSupabaseConfigured) {
      setDataReady(true);
      return;
    }
    try {
      const [p, r] = await Promise.all([fetchPurchasedIds(), fetchReservedIds()]);
      setPurchased(p);
      setReserved(r);
    } catch (err) {
      console.error("Failed to load account data", err);
    } finally {
      setDataReady(true);
    }
  }, [sessionUser?.companyId]);

  const signIn = useCallback((user: SessionUser) => {
    writeSession(user);
    setActiveCompanyId(user.companyId || null);
    setSessionUser(user);
    setDataReady(false);
  }, []);

  const signOut = useCallback(() => {
    clearSession();
    setActiveCompanyId(null);
    setSessionUser(null);
    setPurchased(new Set());
    setReserved(new Set());
    setSearchQuery("");
    setModal({ open: false, title: "", body: null, footer: null });
    setDataReady(true);
  }, []);

  useEffect(() => {
    if (!sessionUser?.id || !isSupabaseConfigured) return;
    void (async () => {
      try {
        const account = await fetchRegistrationById(sessionUser.id);
        if (!account) return;
        const enriched = await buildSessionAccount(account);
        const company = enriched.company_id ? await fetchCompanyById(enriched.company_id) : null;
        const fresh = sessionFromAccount(enriched, company);
        setSessionUser((prev) => {
          if (!prev || prev.id !== fresh.id) return prev;
          const changed =
            prev.isAdmin !== fresh.isAdmin ||
            prev.adminRole !== fresh.adminRole ||
            prev.accountType !== fresh.accountType ||
            prev.companyId !== fresh.companyId ||
            prev.plan !== fresh.plan;
          if (changed) {
            writeSession(fresh);
            return fresh;
          }
          return prev;
        });
      } catch (err) {
        console.error("Failed to refresh session from account", err);
      }
    })();
  }, [sessionUser?.id]);

  const showToastStatic = (message: string, type: ToastType = "") => {
    const id = Date.now() + Math.floor(Math.random() * 999);
    setToasts((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  useEffect(() => {
    refreshUserState();
  }, [refreshUserState]);

  const closeModal = useCallback(() => {
    setModal((prev) => ({ ...prev, open: false }));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = "") => {
    showToastStatic(message, type);
  }, []);

  const openModal = useCallback((title: string, body: ReactNode, footer?: ReactNode) => {
    setModal({ open: true, title, body, footer });
  }, []);

  const buyDriver = useCallback(async (id: number, amount: number) => {
    if (isSupabaseConfigured) {
      await purchaseListing(id, amount);
      await refreshUserState();
      invalidateDataViews(["marketplace", "purchased", "deals", "dashboard"]);
    }
    setPurchased((prev) => new Set(prev).add(id));
  }, [refreshUserState]);

  const reserveDriver = useCallback(async (id: number) => {
    if (isSupabaseConfigured) {
      await reserveListing(id);
      await refreshUserState();
      invalidateDataViews(["marketplace", "dashboard"]);
    }
    setReserved((prev) => new Set(prev).add(id));
  }, [refreshUserState]);

  const loadDriverCard = useCallback(async (id: number): Promise<DriverCard | null> => {
    if (isSupabaseConfigured) {
      return fetchListingCardById(id);
    }
    const { DRIVERS } = await import("../data/drivers");
    const d = DRIVERS.find((x) => x.id === id);
    if (!d) return null;
    return {
      id: d.id,
      first: d.first,
      last: d.last,
      state: d.state,
      exp: d.exp,
      cdl: d.cdl,
      equip: d.equip,
      avail: d.avail,
      score: d.score,
      verified: d.verified,
      price: d.price,
      seller: d.seller,
      sellerRating: d.sellerRating,
      driverType: "Owner Operator",
      featured: d.id <= 3,
      createdAt: new Date().toISOString()
    };
  }, []);

  const openBuyModal = useCallback(
    (id: number, onComplete?: () => void) => {
      void loadDriverCard(id).then((driver) => {
        if (!driver) return;
        openModal(
          "Purchase Driver Lead",
          <>
            <p style={{ marginBottom: 16 }}>
              You are purchasing the lead for <strong>{maskName(driver)}</strong> from{" "}
              <strong>{driver.seller}</strong>.
            </p>
            <div style={{ background: "var(--gray-50)", padding: 16, borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span>Lead Price</span>
                <strong>{fmtPrice(driver.price)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span>Escrow Protection</span>
                <span className="badge badge-green">Included</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--gray-200)", paddingTop: 8 }}>
                <span>Total</span>
                <strong style={{ fontSize: 18 }}>{fmtPrice(driver.price)}</strong>
              </div>
            </div>
            <p style={{ fontSize: 12, color: "var(--gray-500)" }}>
              Upon purchase, full contact details, CDL number, and documents will be released.
              Funds held in escrow until hire confirmation.
            </p>
          </>,
          <>
            <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={() => {
                void buyDriver(id, driver.price)
                  .then(() => {
                    closeModal();
                    showToast("Lead purchased! Contact details released.", "success");
                    onComplete?.();
                  })
                  .catch(() => showToast("Purchase failed. Try again.", "error"));
              }}
            >
              Confirm Purchase - {fmtPrice(driver.price)}
            </button>
          </>
        );
      });
    },
    [buyDriver, closeModal, loadDriverCard, openModal, showToast]
  );

  const openReserveModal = useCallback(
    (id: number, onComplete?: () => void) => {
      void loadDriverCard(id).then((driver) => {
        if (!driver) return;
        openModal(
          "Reserve Driver Lead",
          <>
            <p>
              Reserve <strong>{maskName(driver)}</strong> for <strong>48 hours</strong> while you evaluate the lead.
            </p>
            <div style={{ margin: "16px 0", padding: 14, background: "var(--blue-light)", borderRadius: 8, fontSize: 13 }}>
              Reservation fee: <strong>$25</strong> (applied toward purchase if you buy within 48hrs)
            </div>
          </>,
          <>
            <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={() => {
                void reserveDriver(id)
                  .then(() => {
                    closeModal();
                    showToast("Driver reserved for 48 hours", "success");
                    onComplete?.();
                  })
                  .catch(() => showToast("Reservation failed. Try again.", "error"));
              }}
            >
              Reserve - $25
            </button>
          </>
        );
      });
    },
    [closeModal, loadDriverCard, openModal, reserveDriver, showToast]
  );

  const openDisputeModal = useCallback((presetDealId?: string) => {
    openModal(
      "Open Dispute",
      <DisputeForm
        presetDealId={presetDealId}
        showToast={showToast}
        onCancel={closeModal}
        onSuccess={() => {
          closeModal();
          invalidateDataViews(["disputes", "dashboard"]);
        }}
      />
    );
  }, [closeModal, openModal, showToast]);

  const value = useMemo<AppContextValue>(
    () => ({
      purchased,
      reserved,
      dataReady,
      sessionUser,
      isSignedIn: sessionUser !== null,
      signIn,
      signOut,
      toasts,
      modal,
      searchQuery,
      setSearchQuery,
      debouncedSearch,
      showToast,
      openModal,
      closeModal,
      refreshUserState,
      buyDriver,
      reserveDriver,
      openBuyModal,
      openReserveModal,
      openDisputeModal,
      isPurchased: (id: number) => purchased.has(id),
      isReserved: (id: number) => reserved.has(id)
    }),
    [purchased, reserved, dataReady, sessionUser, signIn, signOut, toasts, modal, searchQuery, debouncedSearch, showToast, openModal, closeModal, refreshUserState, buyDriver, reserveDriver, openBuyModal, openReserveModal, openDisputeModal]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useApp must be used inside AppProvider");
  }
  return ctx;
}
