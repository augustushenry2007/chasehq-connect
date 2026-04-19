import { useApp } from "@/context/AppContext";
import { useState } from "react";

/**
 * "/" — splash while AppContext + FlowMachine settle.
 * Actual navigation is driven declaratively by FlowBootstrap → React Router via state.
 * We render a loader here; FlowBootstrap will dispatch BOOT_* and the user will be navigated.
 */
export default function RootRedirect() {
  const { authReady } = useApp();
  const [showDebug, setShowDebug] = useState(false);

  const handleReset = () => {
    console.log("[DEBUG] Clearing all storage and reloading...");
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
  };

  const flowState = localStorage.getItem("flow_state_v1");
  const onboardingState = localStorage.getItem("onboarding_state");
  const onboardingDone = localStorage.getItem("onboarding_done_session");

  return (
    <div className="min-h-screen flex items-center justify-center bg-background flex-col gap-4">
      <div className="text-sm text-muted-foreground">{authReady ? "Loading…" : "Loading…"}</div>
      <button
        onClick={() => setShowDebug(!showDebug)}
        className="text-xs px-3 py-1.5 rounded border border-border text-muted-foreground hover:text-foreground transition-colors"
      >
        {showDebug ? "Hide Debug" : "Show Debug"}
      </button>

      {showDebug && (
        <div className="text-xs text-muted-foreground bg-card border border-border rounded p-3 max-w-md">
          <div className="space-y-2 font-mono">
            <div>flow_state_v1: {flowState ? JSON.parse(flowState).state : "null"}</div>
            <div>onboarding_done_session: {onboardingDone || "null"}</div>
            <div>onboarding_state step: {onboardingState ? JSON.parse(onboardingState).step : "null"}</div>
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
