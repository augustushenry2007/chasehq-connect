import { useEffect, useRef } from "react";
import { useApp } from "@/context/AppContext";
import { useFlow } from "./FlowMachine";
import { FlowState } from "./states";
import { FIRST_RUN_SESSION_KEY } from "./states";

/**
 * Drives boot-time and reactive transitions:
 *  - On first auth-ready, decides initial state.
 *  - When invoices load on DASHBOARD_EMPTY with items, advances to ACTIVE.
 *  - On sign-out (auth lost), routes back to LANDING.
 *  - On post-boot sign-in (OTP verification completing), advances LANDING.
 */
export function FlowBootstrap() {
  const { authReady, profileReady, isAuthenticated, hasCompletedOnboarding, invoices, invoicesLoading } = useApp();
  const { state, send } = useFlow();
  const bootedRef = useRef(false);
  const lastAuthRef = useRef<boolean | null>(null);

  // BOOT — only once when auth is first ready.
  useEffect(() => {
    if (import.meta.env.DEV) console.log("[FLOW BOOT] effect running: authReady=", authReady, "bootedRef=", bootedRef.current, "isAuthenticated=", isAuthenticated, "profileReady=", profileReady);
    if (!authReady || bootedRef.current) return;

    // If authenticated, wait until the async profile DB query has resolved so that
    // hasCompletedOnboarding is accurate.
    if (isAuthenticated && !profileReady) {
      if (import.meta.env.DEV) console.log("[FLOW BOOT] authReady but profile not yet loaded — waiting for profileReady");
      return;
    }

    bootedRef.current = true;

    if (state !== FlowState.APP_LAUNCH) {
      // Already mid-flow from a persisted state. If user is signed out, force LANDING.
      if (!isAuthenticated) {
        if (import.meta.env.DEV) console.log("[FLOW BOOT] Persisted state with no session → SIGN_OUT (state was", state, ")");
        send("SIGN_OUT");
        return;
      }
      // Authenticated user whose session was auto-restored but persisted flow state is
      // LANDING (e.g. previous sign-out). Route to dashboard.
      if (state === FlowState.LANDING) {
        if (import.meta.env.DEV) console.log("[FLOW BOOT] Authenticated user in LANDING → AUTH_SUCCESS");
        send("AUTH_SUCCESS");
      }
      return;
    }

    if (!isAuthenticated) {
      const isDemo = typeof window !== "undefined"
        && localStorage.getItem("chasehq_demo_mode") === "1";
      if (isDemo) {
        if (import.meta.env.DEV) console.log("[FLOW BOOT] Demo flag set → ONBOARDING (mock-data path)");
        send("BOOT_AUTHED_FRESH_SIGNUP");
        return;
      }
      if (import.meta.env.DEV) console.log("[FLOW BOOT] No session → BOOT_NO_SESSION (demo flag was", localStorage.getItem("chasehq_demo_mode"), ")");
      send("BOOT_NO_SESSION");
      return;
    }

    if (!hasCompletedOnboarding) {
      if (import.meta.env.DEV) console.log("[FLOW BOOT] Authenticated but not onboarded → BOOT_AUTHED_FRESH_SIGNUP");
      send("BOOT_AUTHED_FRESH_SIGNUP");
      return;
    }

    let firstRun = false;
    try {
      firstRun = sessionStorage.getItem(FIRST_RUN_SESSION_KEY) !== "1";
      sessionStorage.setItem(FIRST_RUN_SESSION_KEY, "1");
    } catch {
      /* ignore */
    }
    if (import.meta.env.DEV) console.log("[FLOW BOOT] Authenticated + onboarded →", firstRun ? "BOOT_AUTHED_FIRST_RUN" : "BOOT_AUTHED_RESUMING");
    send(firstRun ? "BOOT_AUTHED_FIRST_RUN" : "BOOT_AUTHED_RESUMING");
  }, [authReady, profileReady, isAuthenticated, hasCompletedOnboarding, state, send]);

  // React to auth changes after boot (sign-out and post-boot sign-in).
  useEffect(() => {
    if (!authReady) return;
    if (lastAuthRef.current === null) {
      lastAuthRef.current = isAuthenticated;
      return;
    }
    if (lastAuthRef.current === true && isAuthenticated === false) {
      send("SIGN_OUT");
      lastAuthRef.current = isAuthenticated;
      return;
    }
    // User signed in after initial boot (OTP completing while showing /welcome).
    if (lastAuthRef.current === false && isAuthenticated === true) {
      // Wait for profile so we can route based on hasCompletedOnboarding.
      // Don't update lastAuthRef yet — the effect must re-fire when profileReady flips.
      if (!profileReady) return;
      if (import.meta.env.DEV) console.log("[FLOW BOOT] Post-boot sign-in detected. hasCompletedOnboarding:", hasCompletedOnboarding, "state:", state);
      if (!hasCompletedOnboarding) {
        send("START");           // LANDING → ONBOARDING
      } else {
        send("AUTH_SUCCESS");    // LANDING → DASHBOARD_ACTIVE
      }
    }
    lastAuthRef.current = isAuthenticated;
  }, [authReady, isAuthenticated, profileReady, hasCompletedOnboarding, send, state]);

  // Once invoices are known, refine dashboard state.
  useEffect(() => {
    if (invoicesLoading) return;
    if (invoices.length > 0) {
      if (state === FlowState.DASHBOARD_EMPTY) {
        send("INVOICES_LOADED");
      }
    }
  }, [invoices.length, invoicesLoading, state, send]);

  // Recovery: if the profile row gets wiped mid-session (admin deletion, manual
  // SQL, etc.), the user is stranded on whatever screen they were on with no
  // route home. Detect post-boot `hasCompletedOnboarding` flipping false and
  // reset to LANDING so they can re-onboard.
  useEffect(() => {
    if (!bootedRef.current) return;
    if (!authReady || !isAuthenticated || !profileReady) return;
    if (hasCompletedOnboarding) return;
    if (state === FlowState.LANDING || state === FlowState.ONBOARDING || state === FlowState.FEATURE_TOUR) return;
    if (import.meta.env.DEV) console.log("[FLOW] post-boot onboarding flag missing — RESET_TO_LANDING from", state);
    send("RESET_TO_LANDING");
  }, [authReady, isAuthenticated, profileReady, hasCompletedOnboarding, state, send]);

  return null;
}
