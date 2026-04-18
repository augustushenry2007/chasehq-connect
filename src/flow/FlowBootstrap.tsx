import { useEffect, useRef } from "react";
import { useApp } from "@/context/AppContext";
import { useFlow } from "./FlowMachine";
import { FlowState } from "./states";
import { FIRST_RUN_SESSION_KEY } from "./states";
import { isGuestOnboarded } from "@/lib/localInvoice";

/**
 * Drives boot-time and reactive transitions:
 *  - On first auth-ready, decides initial state.
 *  - When invoices load on PRE_DASHBOARD_DECISION/DASHBOARD_EMPTY with items, advances to ACTIVE.
 *  - On sign-out (auth lost), routes back to LANDING.
 */
export function FlowBootstrap() {
  const { authReady, isAuthenticated, hasCompletedOnboarding, invoices, invoicesLoading } = useApp();
  const { state, send } = useFlow();
  const bootedRef = useRef(false);
  const lastAuthRef = useRef<boolean | null>(null);

  // BOOT — only once when auth is first ready.
  useEffect(() => {
    if (!authReady || bootedRef.current) return;
    bootedRef.current = true;

    if (state !== FlowState.APP_LAUNCH) {
      // Already mid-flow from a persisted state. If user is signed out AND not a guest who
      // completed onboarding, force LANDING.
      const guestOk = isGuestOnboarded();
      const allowedUnauthStates = [
        FlowState.LANDING,
        FlowState.ONBOARDING,
        FlowState.AUTH,
        FlowState.PRE_DASHBOARD_DECISION,
        FlowState.CREATE_INVOICE,
        FlowState.POST_INVOICE_AUTH,
        FlowState.DASHBOARD_EMPTY,
      ] as const;
      const allowed = (allowedUnauthStates as readonly string[]).includes(state);
      if (!isAuthenticated && !(guestOk && allowed)) {
        send("SIGN_OUT");
      }
      return;
    }

    if (!isAuthenticated) {
      if (isGuestOnboarded()) {
        send("BOOT_GUEST_ONBOARDED");
      } else {
        send("BOOT_NO_SESSION");
      }
      return;
    }
    if (!hasCompletedOnboarding) {
      send("BOOT_NO_SESSION"); // landing — guards route to onboarding
      return;
    }
    // Authenticated + onboarded.
    let firstRun = false;
    try {
      firstRun = sessionStorage.getItem(FIRST_RUN_SESSION_KEY) !== "1";
      sessionStorage.setItem(FIRST_RUN_SESSION_KEY, "1");
    } catch {
      /* ignore */
    }
    send(firstRun ? "BOOT_AUTHED_FIRST_RUN" : "BOOT_AUTHED_RESUMING");
  }, [authReady, isAuthenticated, hasCompletedOnboarding, state, send]);

  // React to sign-out events after boot.
  useEffect(() => {
    if (!authReady) return;
    if (lastAuthRef.current === null) {
      lastAuthRef.current = isAuthenticated;
      return;
    }
    if (lastAuthRef.current === true && isAuthenticated === false) {
      send("SIGN_OUT");
    }
    lastAuthRef.current = isAuthenticated;
  }, [authReady, isAuthenticated, send]);

  // Once invoices are known, refine dashboard state.
  useEffect(() => {
    if (invoicesLoading) return;
    if (invoices.length > 0) {
      if (state === FlowState.DASHBOARD_EMPTY || state === FlowState.PRE_DASHBOARD_DECISION) {
        send("INVOICES_LOADED");
      }
    }
  }, [invoices.length, invoicesLoading, state, send]);

  return null;
}
