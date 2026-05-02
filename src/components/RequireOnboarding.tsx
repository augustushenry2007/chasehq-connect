import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { isGuestOnboarded } from "@/lib/localInvoice";
import { STORAGE_KEYS } from "@/lib/storageKeys";

export default function RequireOnboarding() {
  const { authReady, profileReady, isAuthenticated, hasCompletedOnboarding } = useApp();
  const location = useLocation();

  const [oauthLatched, setOauthLatched] = useState(() => {
    const inProgress = typeof window !== "undefined" && sessionStorage.getItem(STORAGE_KEYS.OAUTH_IN_PROGRESS) === "1";
    const completed = typeof window !== "undefined" && sessionStorage.getItem(STORAGE_KEYS.OAUTH_COMPLETED) === "1";
    return inProgress || completed;
  });

  useEffect(() => {
    const handler = () => {
      const inProgress = sessionStorage.getItem(STORAGE_KEYS.OAUTH_IN_PROGRESS) === "1";
      const completed = sessionStorage.getItem(STORAGE_KEYS.OAUTH_COMPLETED) === "1";
      // flushSync forces React to commit synchronously so the spinner is in the DOM
      // before dispatchEvent returns — needed because iOS WKWebView's MessageChannel
      // fires after rAF, so a plain setState wouldn't commit before GoogleAuth.signIn().
      if (inProgress || completed) flushSync(() => setOauthLatched(true));
      else setOauthLatched(false);
    };
    window.addEventListener("chasehq:oauth-signal", handler);
    return () => window.removeEventListener("chasehq:oauth-signal", handler);
  }, []);

  useEffect(() => {
    if (!oauthLatched) return;
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      const inProgress = sessionStorage.getItem(STORAGE_KEYS.OAUTH_IN_PROGRESS) === "1";
      const completed = sessionStorage.getItem(STORAGE_KEYS.OAUTH_COMPLETED) === "1";
      if (!inProgress && !completed) setOauthLatched(false);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [oauthLatched]);

  useEffect(() => {
    if (isAuthenticated && profileReady) setOauthLatched(false);
  }, [isAuthenticated, profileReady]);

  useEffect(() => {
    if (!oauthLatched) return;
    const t = window.setTimeout(() => {
      sessionStorage.removeItem(STORAGE_KEYS.OAUTH_IN_PROGRESS);
      sessionStorage.removeItem(STORAGE_KEYS.OAUTH_COMPLETED);
      setOauthLatched(false);
    }, 12000);
    return () => window.clearTimeout(t);
  }, [oauthLatched]);

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Getting things ready…</div>
      </div>
    );
  }

  // Hold a neutral splash during OAuth so no tab screen content flashes before auth propagates.
  const oauthInFlight = !(isAuthenticated && profileReady) && (
    oauthLatched
    || sessionStorage.getItem(STORAGE_KEYS.OAUTH_IN_PROGRESS) === "1"
    || sessionStorage.getItem(STORAGE_KEYS.OAUTH_COMPLETED) === "1"
  );
  if (oauthInFlight) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Signing you in…</p>
      </div>
    );
  }

  const guestOk = !isAuthenticated && isGuestOnboarded();
  if (!isAuthenticated && !guestOk) return <Navigate to="/welcome" replace />;

  // Wait for profile to load before making onboarding decisions — avoids redirecting
  // to /onboarding while hasCompletedOnboarding is still false from the async profile fetch.
  if (isAuthenticated && !profileReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Getting things ready…</div>
      </div>
    );
  }

  if (isAuthenticated && !hasCompletedOnboarding) return <Navigate to="/onboarding" replace />;
  return <Outlet key={location.pathname} />;
}
