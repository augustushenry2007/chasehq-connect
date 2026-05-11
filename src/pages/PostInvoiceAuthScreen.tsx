import { useEffect, useRef, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
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
    // Release OAUTH_COMPLETED before dispatching: by now Supabase's session
    // rotation is long past (we're past profile fetch + createInvoice HTTP
    // round-trips), and FlowRouter's `inOAuth` gate would otherwise pin the
    // route at /auth-after-invoice → OAuthOverlay can't dismiss → spinner
    // stuck until OAuthOverlay's 90s safety net fires.
    sessionStorage.removeItem(STORAGE_KEYS.OAUTH_COMPLETED);
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
  // Read sessionStorage on each signal so a failed OAuth (which clears both flags
  // before dispatching the signal in oauth.ts) un-latches the spinner — otherwise
  // the user is stuck on "Setting up your account…" with no way to retry. On the
  // success path, oauth.ts only clears OAUTH_IN_PROGRESS *after* signInWithIdToken
  // succeeded, so isAuthenticated is already true and the spinner condition stays
  // satisfied via the isAuthenticated branch.
  useEffect(() => {
    const handler = () => {
      const inProgress = sessionStorage.getItem(STORAGE_KEYS.OAUTH_IN_PROGRESS) === "1";
      const completed = sessionStorage.getItem(STORAGE_KEYS.OAUTH_COMPLETED) === "1";
      setOauthLatched(inProgress || completed);
    };
    window.addEventListener("chasehq:oauth-signal", handler);
    return () => window.removeEventListener("chasehq:oauth-signal", handler);
  }, []);

  // Belt-and-suspenders POST-AUTH escape hatch: if every downstream timeout
  // (6s profile, 8s auth-ready, 10s flush) somehow fails simultaneously and the
  // dispatch effect above never fires, eject from POST_INVOICE_AUTH via the FSM
  // so the user isn't stuck. Critically: only start the timer once isAuthenticated
  // becomes true. Earlier versions started the timer on `oauthLatched`, which
  // includes the time the user spends interacting with the native iOS GIDSignIn
  // modal (account picker + trust prompt — easily >15s). That fired the escape
  // *during* the native flow, mis-routed the user to DASHBOARD_ACTIVE, and
  // dropped the actual OAuth result into a state where AUTH_SUCCESS was rejected.
  useEffect(() => {
    if (!isAuthenticated) return;
    const t = window.setTimeout(() => {
      if (dispatchedRef.current) return;
      console.warn("[PostInvoiceAuthScreen] Spinner stuck >15s post-auth — escaping via AUTH_SUCCESS");
      sessionStorage.removeItem(STORAGE_KEYS.OAUTH_IN_PROGRESS);
      sessionStorage.removeItem(STORAGE_KEYS.OAUTH_COMPLETED);
      dispatchedRef.current = true;
      send("AUTH_SUCCESS");
    }, 15000);
    return () => window.clearTimeout(t);
  }, [isAuthenticated, send]);

  // Visible spinner fallback. OAuthOverlay (z:9999) shields the very first frames
  // when oauthLatched flips, but if the overlay dismisses before this screen
  // unmounts (route transition still in flight), this spinner takes over so the
  // user never sees a blank screen.
  if (!authReady || isAuthenticated || oauthLatched) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Setting up your account…</p>
      </div>
    );
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
          Sign up to save your draft and start sending follow-ups. ChaseHQ sends each message on your behalf and replies route straight back to your inbox.
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
