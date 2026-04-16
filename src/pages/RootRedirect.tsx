import { Navigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";

export default function RootRedirect() {
  const { isAuthenticated, hasCompletedOnboarding } = useApp();

  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  if (!hasCompletedOnboarding) return <Navigate to="/onboarding" replace />;
  return <Navigate to="/dashboard" replace />;
}
