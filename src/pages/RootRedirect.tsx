import { Navigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { useState, useEffect } from "react";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import { FLOW_STORAGE_KEY } from "@/flow/states";

export default function RootRedirect() {
  const { authReady, isAuthenticated } = useApp();

  // Authenticated users should never be at root — FlowRouter can deadlock here
  // if oauth_in_progress clears but state has no AUTH_SUCCESS transition (so deps never change).
  // Navigate directly to /dashboard as a safety net; RequireOnboarding handles the rest.
  if (authReady && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  const [elapsed, setElapsed] = useState(0);
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const isStuck = elapsed >= 8;

  const handleReset = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = "/";
  };

  const flowState = localStorage.getItem(FLOW_STORAGE_KEY);

  if (!isStuck) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background flex-col gap-4">
      <button
        onClick={() => setShowDebug(!showDebug)}
        className="text-xs px-3 py-1.5 rounded border border-border text-muted-foreground hover:text-foreground transition-colors"
      >
        {showDebug ? "Hide Debug" : "Taking too long?"}
      </button>

      {showDebug && (
        <div className="text-xs text-muted-foreground bg-card border border-border rounded p-3 max-w-md">
          <div className="space-y-2 font-mono">
            <div>authReady: {String(authReady)}</div>
            <div>isAuthenticated: {String(isAuthenticated)}</div>
            <div>elapsed: {elapsed}s</div>
            <div>flow_state: {flowState ? JSON.parse(flowState).state : "null"}</div>
            <div>oauth_in_progress: {sessionStorage.getItem(STORAGE_KEYS.OAUTH_IN_PROGRESS) || "null"}</div>
            <div>oauth_completed: {sessionStorage.getItem(STORAGE_KEYS.OAUTH_COMPLETED) || "null"}</div>
          </div>
          <button
            onClick={handleReset}
            className="mt-3 w-full text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Clear All & Reload
          </button>
        </div>
      )}
    </div>
  );
}
