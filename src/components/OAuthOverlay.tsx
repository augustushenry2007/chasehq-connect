import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Loader2 } from "lucide-react";
import { useLocation } from "react-router-dom";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import { useApp } from "@/context/AppContext";

// Top-level OAuth shield. Sits above all routes so navigation between guarded
// and unguarded routes during OAuth completion (e.g. FlowRouter navigating to
// /onboarding before /dashboard) cannot leak a flash of the underlying screen.
export function OAuthOverlay() {
  const { isAuthenticated, profileReady } = useApp();
  const location = useLocation();
  const isAuthenticatedRef = useRef(isAuthenticated);
  const [signalTick, setSignalTick] = useState(0);
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
        flushSync(() => setShow(true));
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
  // signalTick re-runs this effect whenever chasehq:oauth-signal fires so the new
  // sessionStorage guards are evaluated reactively without polling.
  useEffect(() => {
    if (!show || !isAuthenticated || !profileReady) return;
    if (location.pathname === "/auth-after-invoice") return;
    if (sessionStorage.getItem(STORAGE_KEYS.OAUTH_IN_PROGRESS) === "1") return;
    if (sessionStorage.getItem(STORAGE_KEYS.SEND_AFTER_AUTH)) return;
    sessionStorage.removeItem(STORAGE_KEYS.OAUTH_IN_PROGRESS);
    sessionStorage.removeItem(STORAGE_KEYS.OAUTH_COMPLETED);
    setShow(false);
  }, [show, isAuthenticated, profileReady, location.pathname, signalTick]);

  // 15s safety net for the rare cold-boot case where flags are stale.
  useEffect(() => {
    if (!show) return;
    const t = window.setTimeout(() => {
      sessionStorage.removeItem(STORAGE_KEYS.OAUTH_IN_PROGRESS);
      sessionStorage.removeItem(STORAGE_KEYS.OAUTH_COMPLETED);
      setShow(false);
    }, 15000);
    return () => window.clearTimeout(t);
  }, [show]);

  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-3 bg-background">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Signing you in…</p>
    </div>
  );
}
