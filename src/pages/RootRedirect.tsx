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

  // Unauthenticated users see the welcome screen first.
  if (!isAuthenticated) return <Navigate to="/welcome" replace />;
  if (!hasCompletedOnboarding) return <Navigate to="/onboarding" replace />;
  return <Navigate to="/dashboard" replace />;
}
