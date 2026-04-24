import { useApp } from "@/context/AppContext";
import { useEntitlement } from "@/hooks/useEntitlement";

export type GateState = "loading" | "guest" | "authed_no_trial" | "allowed";

export function useActionGate() {
  const { isAuthenticated, authReady } = useApp();
  const { loading, isTrialing, isActive, isPastDue, trialEndsAt } = useEntitlement();

  let state: GateState;
  if (!authReady) state = "loading";
  else if (!isAuthenticated) state = "guest";
  else if (loading) state = "loading";
  else if (isTrialing || isActive || isPastDue) state = "allowed";
  else state = "authed_no_trial";

  return {
    state,
    canExecute: state === "allowed",
    panelVariant: state === "guest"
      ? "guest"
      : state === "authed_no_trial"
        ? (trialEndsAt ? "expired" : "start_trial")
        : null,
  } as const;
}
