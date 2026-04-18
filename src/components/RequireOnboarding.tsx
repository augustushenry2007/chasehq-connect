import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useApp } from "@/context/AppContext";

export default function RequireOnboarding() {
  const { authReady, isAuthenticated, hasCompletedOnboarding } = useApp();
  const location = useLocation();

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/welcome" replace />;
  if (!hasCompletedOnboarding) return <Navigate to="/onboarding" replace />;
  // Allow /pre-dashboard for authed + onboarded users (machine routes them here on first run).
  return <Outlet key={location.pathname} />;
}
