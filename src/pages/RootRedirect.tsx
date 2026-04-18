import { useApp } from "@/context/AppContext";

/**
 * "/" — splash while AppContext + FlowMachine settle.
 * Actual navigation is driven declaratively by FlowBootstrap → React Router via state.
 * We render a loader here; FlowBootstrap will dispatch BOOT_* and the user will be navigated.
 */
export default function RootRedirect() {
  const { authReady } = useApp();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-sm text-muted-foreground">{authReady ? "Loading…" : "Loading…"}</div>
    </div>
  );
}
