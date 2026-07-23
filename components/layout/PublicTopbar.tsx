import { LogIn, Store, Truck, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";

export function PublicTopbar() {
  return (
    <header className="topbar topbar--public">
      <Link to="/marketplace" className="public-topbar-brand">
        <Truck className="icon-md" aria-hidden />
        <span>CDL Exchange</span>
      </Link>
      <nav className="public-topbar-nav" aria-label="Public navigation">
        <Link to="/marketplace" className="btn btn-ghost btn-sm">
          <Store className="icon-sm" /> Marketplace
        </Link>
        <Link to="/register" className="btn btn-secondary btn-sm">
          <LogIn className="icon-sm" /> Sign In
        </Link>
        <Link to="/register?intent=hire" className="btn btn-primary btn-sm">
          <UserPlus className="icon-sm" /> Register to Hire
        </Link>
      </nav>
    </header>
  );
}
