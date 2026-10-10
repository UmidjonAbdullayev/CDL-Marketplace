import { Navigate, Outlet } from "react-router-dom";
import { canAccessAdminPanel } from "../../lib/account-capabilities";
import { useApp } from "../../context/AppContext";

export function AdminGuard() {
  const { sessionUser, isSignedIn } = useApp();

  if (!isSignedIn) {
    return <Navigate to="/register" replace />;
  }

  if (!canAccessAdminPanel(sessionUser)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
