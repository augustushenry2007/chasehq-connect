import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { isGuestOnboarded } from "@/lib/localInvoice";

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

  // Guests who finished onboarding can explore dashboard / invoices / pre-dashboard.
  const guestOk = !isAuthenticated && isGuestOnboarded();

  if (!isAuthenticated && !guestOk) return <Navigate to="/welcome" replace />;
  if (isAuthenticated && !hasCompletedOnboarding) return <Navigate to="/onboarding" replace />;
  return <Outlet key={location.pathname} />;
}
