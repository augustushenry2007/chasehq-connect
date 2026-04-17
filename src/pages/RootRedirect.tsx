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

  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  if (!hasCompletedOnboarding) return <Navigate to="/quickstart/welcome" replace />;
  return <Navigate to="/dashboard" replace />;
}
