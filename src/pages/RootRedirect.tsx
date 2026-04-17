import { Navigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";

export default function RootRedirect() {
  const { isAuthenticated, hasCompletedOnboarding, authReady } = useApp();

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  // Value-before-friction: app opens directly into onboarding.
  // Onboarding handles auth itself once the user taps "Send now".
  if (!isAuthenticated || !hasCompletedOnboarding) return <Navigate to="/onboarding" replace />;
  return <Navigate to="/dashboard" replace />;
}
