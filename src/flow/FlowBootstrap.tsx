import { useEffect, useRef } from "react";
import { useApp } from "@/context/AppContext";
import { useFlow } from "./FlowMachine";
import { FlowState } from "./states";
import { FIRST_RUN_SESSION_KEY } from "./states";
import { isGuestOnboarded } from "@/lib/localInvoice";
import { STORAGE_KEYS } from "@/lib/storageKeys";

/**
 * Drives boot-time and reactive transitions:
 *  - On first auth-ready, decides initial state.
 *  - When invoices load on DASHBOARD_EMPTY with items, advances to ACTIVE.
 *  - On sign-out (auth lost), routes back to LANDING.
 */
export function FlowBootstrap() {
  const { authReady, profileReady, isAuthenticated, hasCompletedOnboarding, invoices, invoicesLoading, user } = useApp();
  const { state, send } = useFlow();
  const bootedRef = useRef(false);
  const lastAuthRef = useRef<boolean | null>(null);

  // BOOT — only once when auth is first ready.
  useEffect(() => {
    if (import.meta.env.DEV) console.log("[FLOW BOOT] effect running: authReady=", authReady, "bootedRef=", bootedRef.current, "isAuthenticated=", isAuthenticated, "profileReady=", profileReady);
    if (!authReady || bootedRef.current) return;

    // If authenticated, wait until the async profile DB query has resolved so that
    // hasCompletedOnboarding is accurate. Without this guard we can fire boot with
    // hasCompletedOnboarding=false for fully-onboarded users and send them to LANDING.
    if (isAuthenticated && !profileReady) {
      if (import.meta.env.DEV) console.log("[FLOW BOOT] authReady but profile not yet loaded — waiting for profileReady");
      return;
    }

    // At this point the OAuth callback (if any) has completed and the session is established.
    // Check for post-OAuth before clearing the flag.
    const wasOAuth = sessionStorage.getItem(STORAGE_KEYS.OAUTH_IN_PROGRESS) === "1";
    const justCompletedOAuthSession = sessionStorage.getItem(STORAGE_KEYS.OAUTH_COMPLETED) === "1";
    if (wasOAuth || justCompletedOAuthSession) {
      if (import.meta.env.DEV) console.log("[FLOW BOOT] Detected post-OAuth boot, wasOAuth:", wasOAuth, "justCompletedOAuthSession:", justCompletedOAuthSession);
      sessionStorage.removeItem(STORAGE_KEYS.OAUTH_IN_PROGRESS);
      sessionStorage.removeItem(STORAGE_KEYS.OAUTH_COMPLETED);
    }

    bootedRef.current = true;

    // Treat either flag as "post-OAuth" for routing purposes
    const postOAuth = wasOAuth || justCompletedOAuthSession;
    if (import.meta.env.DEV) console.log("[FLOW BOOT] authReady, state:", state, "isAuthenticated:", isAuthenticated, "hasCompletedOnboarding:", hasCompletedOnboarding, "postOAuth:", postOAuth);

    if (state !== FlowState.APP_LAUNCH) {
      // Already mid-flow from a persisted state. If user is signed out AND not a guest who
      // completed onboarding, force LANDING.
      const guestOk = isGuestOnboarded();
      const allowedUnauthStates = [
        FlowState.LANDING,
        FlowState.ONBOARDING,
        FlowState.AUTH,
        FlowState.GUEST_DRAFT,
        FlowState.CREATE_INVOICE,
        FlowState.POST_INVOICE_AUTH,
        FlowState.DASHBOARD_EMPTY,
      ] as const;
      const allowed = (allowedUnauthStates as readonly string[]).includes(state);
      if (import.meta.env.DEV) console.log("[FLOW BOOT] Persisted state:", state, "guestOk:", guestOk, "allowed:", allowed);

      if (!isAuthenticated && !(guestOk && allowed)) {
        if (import.meta.env.DEV) console.log("[FLOW BOOT] Forcing SIGN_OUT");
        send("SIGN_OUT");
        return;
      }
      // User completed Google OAuth while the app was mid-flow (e.g. auth dialog
      // inside AIDraftComposer). Fire AUTH_SUCCESS so FlowRouter can navigate.
      if (postOAuth && isAuthenticated) {
        if (import.meta.env.DEV) console.log("[FLOW BOOT] Post-OAuth mid-flow → AUTH_SUCCESS from", state);
        // POST_INVOICE_AUTH manages its own routing: PostInvoiceAuthScreen sends
        // INVOICE_CREATED once flushedInvoiceId resolves. Firing AUTH_SUCCESS here
        // would bypass that and land the user on the dashboard instead.
        if (state !== FlowState.POST_INVOICE_AUTH) {
          send("AUTH_SUCCESS");
        }
        return;
      }
      // Authenticated user whose session was auto-restored but persisted flow state is
      // a guest-only state (e.g. LANDING after a previous sign-out). Route to dashboard.
      if (isAuthenticated && (state === FlowState.LANDING || state === FlowState.GUEST_DRAFT)) {
        if (import.meta.env.DEV) console.log("[FLOW BOOT] Authenticated user in guest-only state", state, "→ AUTH_SUCCESS");
        send("AUTH_SUCCESS");
        return;
      }
      return;
    }

    if (!isAuthenticated) {
      if (isGuestOnboarded()) {
        if (import.meta.env.DEV) console.log("[FLOW BOOT] Guest onboarded → BOOT_GUEST_ONBOARDED");
        send("BOOT_GUEST_ONBOARDED");
      } else {
        if (import.meta.env.DEV) console.log("[FLOW BOOT] No session → BOOT_NO_SESSION");
        send("BOOT_NO_SESSION");
      }
      return;
    }

    // Authenticated. hasCompletedOnboarding is now reliable because we waited for user above.
    if (!hasCompletedOnboarding) {
      // Guest completed onboarding locally but hasn't persisted to their new account yet.
      // AppContext handles the DB upsert; we just need to advance past onboarding.
      if (isGuestOnboarded() && user) {
        if (import.meta.env.DEV) console.log("[FLOW BOOT] Guest-onboarded user signed in → BOOT_AUTHED_FIRST_RUN");
        send("BOOT_AUTHED_FIRST_RUN");
        return;
      }

      if (import.meta.env.DEV) console.log("[FLOW BOOT] Authenticated but not onboarded → BOOT_AUTHED_FRESH_SIGNUP");
      send("BOOT_AUTHED_FRESH_SIGNUP");
      return;
    }

    // Authenticated + onboarded.
    // OAuth sign-in wipes sessionStorage, so treat it as a resume.
    if (postOAuth) {
      if (import.meta.env.DEV) console.log("[FLOW BOOT] Post-OAuth, onboarded → BOOT_AUTHED_RESUMING");
      send("BOOT_AUTHED_RESUMING");
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
  }, [authReady, profileReady, isAuthenticated, hasCompletedOnboarding, user, state, send]);

  // React to auth changes after boot (sign-out and post-boot sign-in).
  useEffect(() => {
    if (!authReady) return;
    if (lastAuthRef.current === null) {
      lastAuthRef.current = isAuthenticated;
      return;
    }
    if (lastAuthRef.current === true && isAuthenticated === false) {
      send("SIGN_OUT");
    }
    // User signed in after initial boot (e.g. email confirmation link clicked
    // in the same tab, or auth completed while app was already showing).
    if (lastAuthRef.current === false && isAuthenticated === true) {
      if (import.meta.env.DEV) console.log("[FLOW BOOT] Post-boot sign-in detected → AUTH_SUCCESS from", state);
      // POST_INVOICE_AUTH manages its own routing once flushedInvoiceId resolves.
      if (state === FlowState.POST_INVOICE_AUTH) return;
      send("AUTH_SUCCESS");
    }
    lastAuthRef.current = isAuthenticated;
  }, [authReady, isAuthenticated, send, state]);

  // Once invoices are known, refine dashboard state.
  useEffect(() => {
    if (invoicesLoading) return;
    if (invoices.length > 0) {
      if (state === FlowState.DASHBOARD_EMPTY) {
        send("INVOICES_LOADED");
      }
    }
  }, [invoices.length, invoicesLoading, state, send]);

  return null;
}
