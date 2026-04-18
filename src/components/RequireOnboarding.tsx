import { Navigate, Outlet } from "react-router-dom";
import { useApp } from "@/context/AppContext";

export default function RequireOnboarding() {
  const { authReady, isAuthenticated, hasCompletedOnboarding } = useApp();

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/welcome" replace />;
  if (!hasCompletedOnboarding) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}
