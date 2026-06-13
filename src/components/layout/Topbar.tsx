import { Bell, Menu, MessageCircle, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { useExchangeData } from "../../context/ExchangeDataContext";
import { NotificationsPanel } from "./NotificationsPanel";

export function Topbar({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const navigate = useNavigate();
  const { searchQuery, setSearchQuery, showToast, sessionUser, signOut } = useApp();
  const { badges, notifications, dismissAllNotifications } = useExchangeData();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onDocClick = () => setMenuOpen(false);
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const handleSignOut = () => {
    setMenuOpen(false);
    signOut();
    showToast("Signed out successfully", "success");
    navigate("/register", { state: { signedOut: true } });
  };

  const initials = sessionUser?.initials ?? "—";
  const displayName = sessionUser?.name ?? "Guest";
  const displayPlan = sessionUser?.plan ?? "";

  return (
    <header className="topbar">
      <button className="menu-toggle" id="menuToggle" onClick={onToggleSidebar} aria-label="Open menu">
        <Menu />
      </button>
      <div className="topbar-search">
        <div className="search-wrap">
          <span className="search-icon"><Search style={{ width: 18, height: 18 }} /></span>
          <input
            ref={inputRef}
            type="text"
            id="globalSearch"
            className="search-input"
            placeholder="Search drivers, deals, listings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <span className="search-kbd">⌘ K</span>
        </div>
      </div>
      <div className="topbar-actions">
        <div className="notif-wrap">
          <button
            className="icon-btn"
            id="notifBtn"
            title="Notifications"
            onClick={(e) => {
              e.stopPropagation();
              setNotifOpen((v) => !v);
            }}
          >
            <Bell />
            {notifications.length > 0 ? <span className="notif-badge">{notifications.length}</span> : null}
          </button>
          <NotificationsPanel
            open={notifOpen}
            onClose={() => setNotifOpen(false)}
            items={notifications}
            onMarkAllRead={dismissAllNotifications}
          />
        </div>
        <button className="icon-btn" id="msgBtn" title="Messages" onClick={() => navigate("/messages")}>
          <MessageCircle />
          {badges.messages > 0 ? <span className="notif-badge">{badges.messages}</span> : null}
        </button>
        <div className="user-menu">
          <button
            className="user-btn"
            id="userMenuBtn"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
          >
            <div className="user-avatar">{initials}</div>
            <div className="user-text" style={{ textAlign: "left" }}>
              <div className="user-name">{displayName}</div>
              {displayPlan ? <div style={{ fontSize: 11, color: "var(--gray-500)" }}>{displayPlan}</div> : null}
            </div>
          </button>
          <div className={`dropdown ${menuOpen ? "open" : ""}`} id="userDropdown">
            <button onClick={() => navigate("/profile")}>View Profile</button>
            <button onClick={() => navigate("/pricing")}>Billing</button>
            <button onClick={() => navigate("/settings")}>Settings</button>
            <button onClick={() => navigate("/admin")}>Admin Panel</button>
            <button onClick={() => navigate("/register")}>Create account</button>
            <div className="divider" />
            <button type="button" onClick={handleSignOut}>Sign Out</button>
          </div>
        </div>
      </div>
    </header>
  );
}
