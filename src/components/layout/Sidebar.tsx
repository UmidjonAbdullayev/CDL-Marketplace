import { Link, useLocation } from "react-router-dom";
import {
  AlertTriangle,
  Building2,
  CheckCircle,
  ChevronRight,
  CreditCard,
  FileText,
  Handshake,
  LayoutDashboard,
  MessageSquare,
  PlusCircle,
  Settings,
  ShieldCheck,
  Store,
  Truck,
  UserCog
} from "lucide-react";
import { useApp } from "../../context/AppContext";
import { useExchangeData } from "../../context/ExchangeDataContext";
import { canAccessAdminPanel, isSellerNav } from "../../lib/account-capabilities";
import { fmtPrice } from "../../lib/format";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  badgeKey?: "disputes" | "messages" | "ongoingDeals";
  sellerOnly?: boolean;
  buyerOnly?: boolean;
  adminOnly?: boolean;
};

const SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: "Marketplace",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/marketplace", label: "Marketplace", icon: Store },
      { to: "/sell", label: "Sell / List Driver", icon: PlusCircle }
    ]
  },
  {
    label: "Transactions",
    items: [
      { to: "/my-listings", label: "My Listings", icon: FileText },
      { to: "/ongoing-deals", label: "Ongoing Deals", icon: CheckCircle, badgeKey: "ongoingDeals" },
      { to: "/deals", label: "Deals / Escrow", icon: Handshake },
      { to: "/disputes", label: "Disputes", icon: AlertTriangle, badgeKey: "disputes" },
      { to: "/messages", label: "Messages", icon: MessageSquare, badgeKey: "messages" }
    ]
  },
  {
    label: "Account",
    items: [
      { to: "/profile", label: "Recruiter Profile", icon: Building2, sellerOnly: true },
      { to: "/profile", label: "Company Profile", icon: Building2, buyerOnly: true },
      { to: "/pricing", label: "Pricing / Billing", icon: CreditCard },
      { to: "/compliance", label: "Compliance Center", icon: ShieldCheck },
      { to: "/admin", label: "Admin Panel", icon: UserCog, adminOnly: true },
      { to: "/settings", label: "Settings", icon: Settings }
    ]
  }
];

export function Sidebar({ open, onNavigate }: { open: boolean; onNavigate?: () => void }) {
  const location = useLocation();
  const { showToast, sessionUser, setSearchQuery } = useApp();
  const { badges } = useExchangeData();

  const isSeller = isSellerNav(sessionUser);

  const isActive = (to: string) =>
    location.pathname === to || (to === "/dashboard" && location.pathname === "/");

  const visibleItems = (items: NavItem[]) =>
    items.filter((item) => {
      if (item.adminOnly && !canAccessAdminPanel(sessionUser)) return false;
      if (item.sellerOnly && !isSeller) return false;
      if (item.buyerOnly && isSeller) return false;
      return true;
    });

  return (
    <aside className={`sidebar ${open ? "open" : ""}`} id="sidebar">
      <div className="sidebar-brand">
        <div className="brand-logo">
          <div className="brand-icon"><Truck /></div>
          <div>
            <h1>CDL Exchange</h1>
            <div className="tagline">Driver Recruiting Platform</div>
          </div>
        </div>
      </div>
      <nav className="sidebar-nav">
        {SECTIONS.map((section) => {
          const items = visibleItems(section.items);
          if (!items.length) return null;
          return (
            <div className="nav-section" key={section.label}>
              <div className="nav-label">{section.label}</div>
              {items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.to);
                const badgeCount = item.badgeKey ? badges[item.badgeKey] : 0;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`nav-item ${active ? "active" : ""}`}
                    onClick={() => {
                      if (item.adminOnly) setSearchQuery("");
                      onNavigate?.();
                    }}
                  >
                    <span className="icon"><Icon /></span>
                    {item.label}
                    {badgeCount > 0 ? (
                      <span className="nav-badge blue">{badgeCount > 99 ? "99+" : badgeCount}</span>
                    ) : null}
                    <ChevronRight className="nav-chevron" />
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>
      <div className="sidebar-wallet">
        <div className="wallet-card">
          <div className="wallet-balance-label">Wallet Balance</div>
          <div className="wallet-balance">{fmtPrice(sessionUser?.walletBalance ?? 0)}</div>
          <button className="btn-deposit" type="button" onClick={() => showToast("Deposit funds", "success")}>
            Deposit Funds
          </button>
        </div>
      </div>
    </aside>
  );
}
