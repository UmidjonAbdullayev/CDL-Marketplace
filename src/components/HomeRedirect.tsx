import { Navigate } from "react-router-dom";
import { useApp } from "../context/AppContext";

export default function HomeRedirect() {
  const { isSignedIn } = useApp();
  return <Navigate to={isSignedIn ? "/dashboard" : "/register"} replace />;
}
