import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import AuthForm from "@/components/auth/AuthForm";
import { useApp } from "@/context/AppContext";
import { useFlow } from "@/flow/FlowMachine";
import { readPending, savePending } from "@/lib/localInvoice";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import { useEntitlement } from "@/hooks/useEntitlement";

// Runs at module-load time — before AppContext's flush useEffect reads localStorage.
// Restores the pending invoice from ?pi= if it was carried across a cross-origin
// OAuth redirect (Capacitor WebView → chasehq.app).
if (typeof window !== "undefined") {
  const _pi = new URLSearchParams(window.location.search).get("pi");
  if (_pi && !readPending()) {
    try {
      const _inv = JSON.parse(decodeURIComponent(_pi));
      if (_inv?.client) savePending(_inv);
    } catch { /* ignore malformed param */ }
  }
}

export default function PostInvoiceAuthScreen() {
  const { isAuthenticated, authReady, profileReady, flushedInvoiceId } = useApp();
  const { send } = useFlow();
  const { refetch: refetchEntitlement } = useEntitlement();

  // Wait for auth, profile, AND the invoice flush to resolve before navigating.
  // flushedInvoiceId is undefined until the flush useEffect in AppContext completes.
  // dispatchedRef gates the dispatch — without it, when the FSM transitions out of
  // POST_INVOICE_AUTH the `send` callback identity changes (it's keyed on state), this
  // effect re-fires, and we'd dispatch the same event from the new state and have it
  // rejected.
  const dispatchedRef = useRef(false);
  useEffect(() => {
    if (dispatchedRef.current) return;
    if (!isAuthenticated || !profileReady || flushedInvoiceId === undefined) return;
    dispatchedRef.current = true;
    void refetchEntitlement();
    if (flushedInvoiceId) {
      send("INVOICE_CREATED", { invoiceId: flushedInvoiceId });
    } else {
      send("AUTH_SUCCESS");
    }
  }, [isAuthenticated, profileReady, flushedInvoiceId, send, refetchEntitlement]);

  // Latch into spinner-only render the instant OAuth begins (or is detected at mount).
  // Once latched, AuthForm will not re-render under any circumstance — eliminating the
  // SVC-close flash where the previously-rendered AuthForm becomes visible for one or
  // more frames before React can flush a state-driven swap.
  //
  // Initial value: true if OAuth is already in flight or just completed (cold-launch
  // deep-link path where appUrlOpen has set OAUTH_COMPLETED before we mount).
  // Listener: startGoogleOAuth dispatches "chasehq:oauth-signal" synchronously when
  // the user taps the Google button, so we latch BEFORE the SVC opens — the spinner
  // is already on screen by the time the SVC closes.
  const [oauthLatched, setOauthLatched] = useState(() =>
    sessionStorage.getItem(STORAGE_KEYS.OAUTH_IN_PROGRESS) === "1" ||
    sessionStorage.getItem(STORAGE_KEYS.OAUTH_COMPLETED) === "1"
  );
  useEffect(() => {
    const handler = () => setOauthLatched(true);
    window.addEventListener("chasehq:oauth-signal", handler);
    return () => window.removeEventListener("chasehq:oauth-signal", handler);
  }, []);

  // Hard escape hatch: if the spinner is still showing after 15s without dispatching,
  // something has stalled (network hang, profile fetch never resolved). Bail to "/" so
  // the user is never permanently stuck. Real OAuth + profile fetch resolves in 2-5s.
  useEffect(() => {
    if (!isAuthenticated && !oauthLatched) return;
    const t = window.setTimeout(() => {
      if (dispatchedRef.current) return;
      console.warn("[PostInvoiceAuthScreen] Spinner stuck >15s — escaping to /");
      sessionStorage.removeItem(STORAGE_KEYS.OAUTH_IN_PROGRESS);
      sessionStorage.removeItem(STORAGE_KEYS.OAUTH_COMPLETED);
      window.location.replace("/");
    }, 15000);
    return () => window.clearTimeout(t);
  }, [isAuthenticated, oauthLatched]);

  if (!authReady || isAuthenticated || oauthLatched) {
    return null; // OAuthOverlay (z:9999) is the sole visual shield during this period
  }

  return (
    <div className="min-h-screen bg-background flex flex-col px-6 py-8 animate-page-enter">
      <div className="w-full max-w-sm mx-auto flex-1 flex flex-col justify-center">
        <div className="inline-flex items-center gap-1.5 bg-accent px-3 py-1.5 rounded-full mb-4 self-start">
          <Sparkles className="w-3 h-3 text-primary" />
          <span className="text-xs font-semibold text-accent-foreground uppercase tracking-wider">
            Nice work
          </span>
        </div>
        <h1 className="text-2xl font-bold text-foreground leading-tight">
          Your follow-up is ready.
        </h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed mb-6">
          Sign up to save your draft and start sending follow-ups. By continuing, you grant ChaseHQ permission to send emails from your Gmail address on your behalf. We never read your inbox. You can revoke access anytime in your Google account.
        </p>

        <AuthForm
          redirectTo={(() => {
            const pending = readPending();
            const piSuffix = pending ? "?pi=" + encodeURIComponent(JSON.stringify(pending)) : "";
            return window.location.origin + "/auth-after-invoice" + piSuffix;
          })()}
          initialMode="signup"
        />
      </div>
    </div>
  );
}
