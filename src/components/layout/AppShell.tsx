import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { Modal } from "./Modal";
import { ToastContainer } from "./ToastContainer";
import { StickyUpgradeBanner } from "./StickyUpgradeBanner";
import { useApp } from "../../context/AppContext";
import { useExchangeData } from "../../context/ExchangeDataContext";
import { shouldLaunchMarketplaceSearch } from "../../lib/search-navigation";

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { debouncedSearch, isSignedIn, setSearchQuery } = useApp();
  const { appLoading } = useExchangeData();
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
          <Outlet />
        </div>
      </div>
      <Modal />
      <ToastContainer />
      <StickyUpgradeBanner />
    </div>
  );
}
