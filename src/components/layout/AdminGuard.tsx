import { Navigate, Outlet } from "react-router-dom";
import { useApp } from "../../context/AppContext";

export function AdminGuard() {
  const { sessionUser, isSignedIn } = useApp();

  if (!isSignedIn) {
    return <Navigate to="/register" replace />;
  }

  if (!sessionUser?.isAdmin && sessionUser?.adminRole === "none") {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
