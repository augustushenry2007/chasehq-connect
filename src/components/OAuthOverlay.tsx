import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useLocation } from "react-router-dom";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import { useApp } from "@/context/AppContext";
import { AuthHydratingSplash } from "@/components/AuthHydratingSplash";
import { EarlyMirrorSlide } from "@/components/onboarding/EarlyMirrorSlide";
import { isGuestOnboarded } from "@/lib/localInvoice";

// Top-level OAuth shield. Sits above all routes so navigation between guarded
// and unguarded routes during OAuth completion (e.g. FlowRouter navigating to
// /onboarding before /dashboard) cannot leak a flash of the underlying screen.

type SplashType = "signin" | "signup";
function readSplashType(): SplashType {
  if (typeof window === "undefined") return "signup";
  return sessionStorage.getItem(STORAGE_KEYS.SIGN_IN_INTENT) === "1" ? "signin" : "signup";
}

export function OAuthOverlay() {
  const { isAuthenticated, profileReady } = useApp();
  const location = useLocation();
  const isAuthenticatedRef = useRef(isAuthenticated);
  const [signalTick, setSignalTick] = useState(0);
  const [splashType, setSplashType] = useState<SplashType>(readSplashType);
  const [originPath, setOriginPath] = useState("");
  const [show, setShow] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(STORAGE_KEYS.OAUTH_IN_PROGRESS) === "1"
        || sessionStorage.getItem(STORAGE_KEYS.OAUTH_COMPLETED) === "1";
  });

  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  useEffect(() => {
    const handler = () => {
      setSignalTick(t => t + 1);
      const inProgress = sessionStorage.getItem(STORAGE_KEYS.OAUTH_IN_PROGRESS) === "1";
      const completed = sessionStorage.getItem(STORAGE_KEYS.OAUTH_COMPLETED) === "1";
      if (inProgress || completed) {
        const next = readSplashType();
        dismissedRef.current = false;
        const capturedPath = typeof window !== "undefined" ? window.location.pathname : "";
        flushSync(() => {
          setSplashType(next);
          setOriginPath(capturedPath);
          setShow(true);
        });
      } else {
        // Defer the dismiss check: the cleanup signal fires synchronously after
        // signInWithIdToken resolves, but React 18's scheduler commits setIsAuthenticated(true)
        // on the next tick — after this code. At 100ms, React has committed; if auth
        // succeeded, isAuthenticatedRef.current is true and we skip dismiss. For
        // cancellation, isAuthenticated stays false → dismiss cleanly.
        setTimeout(() => {
          const stillInProgress = sessionStorage.getItem(STORAGE_KEYS.OAUTH_IN_PROGRESS) === "1";
          const stillCompleted = sessionStorage.getItem(STORAGE_KEYS.OAUTH_COMPLETED) === "1";
          const stillSendAfterAuth = !!sessionStorage.getItem(STORAGE_KEYS.SEND_AFTER_AUTH);
          if (!isAuthenticatedRef.current && !stillInProgress && !stillCompleted && !stillSendAfterAuth) {
            setShow(false);
          }
        }, 100);
      }
    };
    window.addEventListener("chasehq:oauth-signal", handler);
    return () => window.removeEventListener("chasehq:oauth-signal", handler);
  }, []);

  // Hold overlay until auth is fully resolved (profile fetch complete), we've navigated
  // away from /auth-after-invoice, oauth finalization is done (OAUTH_IN_PROGRESS cleared),
  // and the send modal is committed (SEND_AFTER_AUTH cleared by AIDraftComposer).
  // Only dismiss in response to an explicit signal-tick change — never on incidental
  // pathname/auth/profileReady changes that happen during the route shuffle. Otherwise
  // independent commits during the OAuth round-trip can drop the overlay before the
  // destination has painted, producing a flash of the underlying screen.
  const lastDismissTickRef = useRef(0);
  const dismissedRef = useRef(false);
  useEffect(() => {
    if (!show || !isAuthenticated || !profileReady) return;
    if (location.pathname === "/auth-after-invoice") return;
    if (location.pathname === "/welcome" || location.pathname === "/") return;
    if (sessionStorage.getItem(STORAGE_KEYS.OAUTH_IN_PROGRESS) === "1") return;
    if (sessionStorage.getItem(STORAGE_KEYS.SEND_AFTER_AUTH)) return;
    if (signalTick === lastDismissTickRef.current) return;
    lastDismissTickRef.current = signalTick;
    const blocker = typeof document !== "undefined"
      ? document.getElementById("oauth-blocker") as HTMLElement | null
      : null;
    if (blocker) blocker.style.display = "none";
    sessionStorage.removeItem(STORAGE_KEYS.OAUTH_IN_PROGRESS);
    // Defer OAUTH_COMPLETED clear: Supabase rotates the session briefly after
    // sign-in (SIGNED_OUT then SIGNED_IN), flipping isAuthenticated false for
    // a tick. Downstream guards (RequireOnboarding, FlowBootstrap, FlowRouter)
    // use OAUTH_COMPLETED to suppress /welcome navigation during that window.
    // 30s covers any plausible rotation timing.
    window.setTimeout(() => {
      sessionStorage.removeItem(STORAGE_KEYS.OAUTH_COMPLETED);
    }, 30000);
    dismissedRef.current = true;
    setShow(false);
  }, [show, isAuthenticated, profileReady, location.pathname, signalTick]);

  // 90s safety net for stuck-flag recovery. Must exceed any plausible native
  // sign-in duration (account picker + password + 2FA on slow LTE), otherwise
  // it tears down the shield mid-flow and exposes whatever route is underneath.
  useEffect(() => {
    if (!show) return;
    const t = window.setTimeout(() => {
      const blocker = typeof document !== "undefined"
        ? document.getElementById("oauth-blocker") as HTMLElement | null
        : null;
      if (blocker) blocker.style.display = "none";
      sessionStorage.removeItem(STORAGE_KEYS.OAUTH_IN_PROGRESS);
      sessionStorage.removeItem(STORAGE_KEYS.OAUTH_COMPLETED);
      dismissedRef.current = true;
      setShow(false);
    }, 90000);
    return () => window.clearTimeout(t);
  }, [show]);

  // Synchronous sessionStorage check: `show` is React state set by the signal
  // handler, but on iOS WKWebView the pause/resume around the native Google
  // modal can land a render between resume and handler invocation. The
  // sessionStorage flags are durable across that pause, so deriving visibility
  // from them on every render closes the exposure window.
  const flagsActiveNow = typeof window !== "undefined" && (
    sessionStorage.getItem(STORAGE_KEYS.OAUTH_IN_PROGRESS) === "1" ||
    sessionStorage.getItem(STORAGE_KEYS.OAUTH_COMPLETED) === "1"
  );
  const effectiveShow = !dismissedRef.current && (show || flagsActiveNow);
  if (!effectiveShow) return null;
  // splashType is captured as state at the moment OAuth begins (when SIGN_IN_INTENT
  // is still authoritative). It doesn't recompute on every render, so AppContext
  // clearing SIGN_IN_INTENT mid-flow can't flip the visible splash.
  //
  // EarlyMirrorSlide is only meaningful before onboarding; this app always onboards
  // as a guest first, so during any real OAuth round-trip the neutral splash is correct.
  // (Showing the onboarding mirror slide here also flashed it for a frame after the
  // native GIDSignIn modal closed, before originPath caught up to /auth-after-invoice.)
  const showEarlyMirror =
    splashType !== "signin" &&
    originPath !== "/auth-after-invoice" &&
    !(typeof window !== "undefined" && sessionStorage.getItem(STORAGE_KEYS.SEND_AFTER_AUTH)) &&
    !isGuestOnboarded();
  return showEarlyMirror ? <EarlyMirrorSlide /> : <AuthHydratingSplash fixed />;
}
