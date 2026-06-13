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
  Truck
} from "lucide-react";
import { useApp } from "../../context/AppContext";
import { useExchangeData } from "../../context/ExchangeDataContext";

const SECTIONS = [
  {
    label: "Marketplace",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/marketplace", label: "Marketplace", icon: Store },
      { to: "/sell", label: "Sell / List Driver", icon: PlusCircle },
      { to: "/my-listings", label: "My Listings", icon: FileText },
      { to: "/ongoing-deals", label: "Ongoing Deals", icon: CheckCircle }
    ]
  },
  {
    label: "Transactions",
    items: [
      { to: "/deals", label: "Deals / Escrow", icon: Handshake },
      { to: "/disputes", label: "Disputes", icon: AlertTriangle, badgeKey: "disputes" as const },
      { to: "/messages", label: "Messages", icon: MessageSquare, badgeKey: "messages" as const }
    ]
  },
  {
    label: "Account",
    items: [
      { to: "/profile", label: "Company Profile", icon: Building2 },
      { to: "/pricing", label: "Pricing / Billing", icon: CreditCard },
      { to: "/compliance", label: "Compliance Center", icon: ShieldCheck },
      { to: "/settings", label: "Settings", icon: Settings }
    ]
  }
];

export function Sidebar({ open, onNavigate }: { open: boolean; onNavigate?: () => void }) {
  const location = useLocation();
  const { showToast } = useApp();
  const { badges } = useExchangeData();

  const isActive = (to: string) =>
    location.pathname === to || (to === "/dashboard" && location.pathname === "/");

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
        {SECTIONS.map((section) => (
          <div className="nav-section" key={section.label}>
            <div className="nav-label">{section.label}</div>
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.to);
              const badgeKey = "badgeKey" in item ? item.badgeKey : null;
              const badgeCount = badgeKey ? badges[badgeKey] : 0;
              return (
                <Link key={item.to} to={item.to} className={`nav-item ${active ? "active" : ""}`} onClick={onNavigate}>
                  <span className="icon"><Icon /></span>
                  {item.label}
                  {badgeCount > 0 ? (
                    <span className="nav-badge blue">{badgeCount}</span>
                  ) : null}
                  <ChevronRight className="nav-chevron" />
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="sidebar-wallet">
        <div className="wallet-card">
          <div className="wallet-balance-label">Wallet Balance</div>
          <div className="wallet-balance">$4,280.00</div>
          <button className="btn-deposit" type="button" onClick={() => showToast("Deposit funds (demo)", "success")}>
            Deposit Funds
          </button>
        </div>
      </div>
    </aside>
  );
}
