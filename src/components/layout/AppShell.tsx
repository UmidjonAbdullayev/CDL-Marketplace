import { useCallback, useEffect, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { Modal } from "./Modal";
import { ToastContainer } from "./ToastContainer";
import { StickyUpgradeBanner } from "./StickyUpgradeBanner";
import { PaymentProcessingBanner } from "../billing/PaymentProcessingBanner";
import { WalletDepositPendingBanner } from "../billing/WalletDepositPendingBanner";
import { useApp } from "../../context/AppContext";
import { useExchangeData } from "../../context/ExchangeDataContext";
import { canActAsCarrier, isPlatformManager, isSellerNav } from "../../lib/account-capabilities";
import { fmtPrice } from "../../lib/format";
import { carrierPlanLabel } from "../../lib/carrier-plans";
import type { CarrierPlanId } from "../../types/registration";
import {
  isOrderSoundUnlocked,
  useRecruiterOrderAlert
} from "../../hooks/useRecruiterOrderAlert";
import {
  useManagerPaymentAlert,
  type ManagerPaymentAlertPayload
} from "../../hooks/useManagerPaymentAlert";
import { shouldLaunchMarketplaceSearch } from "../../lib/search-navigation";

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { debouncedSearch, isSignedIn, setSearchQuery, sessionUser, showToast } = useApp();
  const { appLoading, refreshNotifications } = useExchangeData();
  const isRecruiter = isSellerNav(sessionUser);
  const isManager = isPlatformManager(sessionUser);

  const onNewOrder = useCallback(
    (dealId: string) => {
      if (!isOrderSoundUnlocked()) {
        showToast(`New order on deal ${dealId} — click anywhere on the page to enable sounds`, "success");
      }
    },
    [showToast]
  );

  const onNewPaymentApproval = useCallback(
    (payload: ManagerPaymentAlertPayload) => {
      void refreshNotifications();
      if (!isOrderSoundUnlocked()) {
        showToast("New payment awaiting approval — click anywhere on the page to enable sounds", "success");
        return;
      }
      if (payload.kind === "wallet_deposit") {
        showToast(`Wallet deposit ${fmtPrice(payload.amount)} needs approval`, "success");
      } else {
        const plan = payload.plan ? carrierPlanLabel(payload.plan as CarrierPlanId) : "paid plan";
        showToast(`Carrier ${plan} payment needs approval`, "success");
      }
    },
    [refreshNotifications, showToast]
  );

  useRecruiterOrderAlert(sessionUser, isRecruiter ? onNewOrder : undefined);
  useManagerPaymentAlert(sessionUser, isManager ? onNewPaymentApproval : undefined);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === "/admin") {
      setSearchQuery("");
    }
  }, [location.pathname, setSearchQuery]);

  useEffect(() => {
    if (shouldLaunchMarketplaceSearch(location.pathname, debouncedSearch)) {
      navigate("/marketplace");
    }
  }, [debouncedSearch, location.pathname, navigate]);

  useEffect(() => {
    document.body.classList.toggle("sidebar-open", sidebarOpen && window.innerWidth <= 768);
    return () => document.body.classList.remove("sidebar-open");
  }, [sidebarOpen]);

  useEffect(() => {
    document.getElementById("content")?.scrollTo(0, 0);
  }, [location.pathname]);

  const closeSidebar = () => setSidebarOpen(false);

  if (!isSignedIn) {
    return <Navigate to="/register" replace state={{ signedOut: true, from: location.pathname }} />;
  }

  if (appLoading) {
    return (
      <div className="marketplace-loader" style={{ minHeight: "100vh", border: "none", borderRadius: 0 }}>
        <div className="marketplace-loader-spinner" aria-hidden />
        <p className="t-body">Loading CDL Exchange...</p>
        <p className="t-caption t-secondary">Preparing your marketplace data</p>
      </div>
    );
  }

  return (
    <div className="app">
      <div
        className={`sidebar-overlay ${sidebarOpen ? "open" : ""}`}
        id="sidebarOverlay"
        onClick={closeSidebar}
      />
      <Sidebar open={sidebarOpen} onNavigate={closeSidebar} />
      <div className="main">
        <Topbar onToggleSidebar={() => setSidebarOpen((v) => !v)} />
        <div className="content" id="content">
          {canActAsCarrier(sessionUser) && sessionUser ? (
            <div className="content-banner-wrap">
              <PaymentProcessingBanner plan={sessionUser.selectedPlan} status={sessionUser.status} />
              <WalletDepositPendingBanner />
            </div>
          ) : null}
          <Outlet />
        </div>
      </div>
      <Modal />
      <ToastContainer />
      <StickyUpgradeBanner />
    </div>
  );
}
