import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useFlow } from "@/flow/FlowMachine";
import { useApp } from "@/context/AppContext";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import { GoogleAuthSheet } from "@/components/auth/GoogleAuthSheet";
import appLogo from "@/assets/app-logo.png";

function useDemoTap() {
  const count = useRef(0);
  const last = useRef(0);
  return () => {
    const now = Date.now();
    if (now - last.current > 1500) count.current = 0;
    last.current = now;
    if (++count.current >= 7) {
      count.current = 0;
      localStorage.setItem("chasehq_demo_mode", localStorage.getItem("chasehq_demo_mode") === "1" ? "0" : "1");
      window.location.reload();
    }
  };
}

export default function WelcomeScreen() {
  const { send: sendFlow } = useFlow();
  const { isAuthenticated } = useApp();
  const handleDemoTap = useDemoTap();
  const isDemoMode = localStorage.getItem("chasehq_demo_mode") === "1";

  const [oauthLatched, setOauthLatched] = useState(() =>
    typeof window !== "undefined" && (
      sessionStorage.getItem(STORAGE_KEYS.OAUTH_IN_PROGRESS) === "1" ||
      sessionStorage.getItem(STORAGE_KEYS.OAUTH_COMPLETED) === "1"
    )
  );
  const [signInOpen, setSignInOpen] = useState(false);

  useEffect(() => {
    const handler = () => {
      const inProgress = sessionStorage.getItem(STORAGE_KEYS.OAUTH_IN_PROGRESS) === "1";
      const completed = sessionStorage.getItem(STORAGE_KEYS.OAUTH_COMPLETED) === "1";
      setOauthLatched(inProgress || completed);
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
    if (!oauthLatched || isAuthenticated) return;
    const t = window.setTimeout(() => {
      sessionStorage.removeItem(STORAGE_KEYS.OAUTH_IN_PROGRESS);
      sessionStorage.removeItem(STORAGE_KEYS.OAUTH_COMPLETED);
      sessionStorage.removeItem(STORAGE_KEYS.SIGN_IN_INTENT);
      setOauthLatched(false);
    }, 90000);
    return () => window.clearTimeout(t);
  }, [oauthLatched, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      const inProgress = sessionStorage.getItem(STORAGE_KEYS.OAUTH_IN_PROGRESS) === "1";
      const completed = sessionStorage.getItem(STORAGE_KEYS.OAUTH_COMPLETED) === "1";
      if (!inProgress && !completed) setOauthLatched(false);
    }
  }, [isAuthenticated]);

  // Synchronous read at render time. The React-state guard (oauthLatched) is
  // updated by an event handler, which can lag a render behind the WKWebView
  // resume after the native Google modal closes. Reading sessionStorage here
  // means the durable flag wins on every render — no exposure window.
  // Return null (not the splash) because OAuthOverlay is mounted above this
  // route and renders the splash itself with z-[9999]. Stacking two splashes
  // is wasteful; an empty bg-background paint is far better than the Welcome
  // logo+CTA flashing if both guards somehow drop.
  const inProgressNow = typeof window !== "undefined"
    && sessionStorage.getItem(STORAGE_KEYS.OAUTH_IN_PROGRESS) === "1";
  const completedNow = typeof window !== "undefined"
    && sessionStorage.getItem(STORAGE_KEYS.OAUTH_COMPLETED) === "1";
  if (inProgressNow || completedNow || oauthLatched || isAuthenticated) {
    return null;
  }

  return (
    <div className="relative h-screen bg-background flex flex-col items-center justify-center px-6 overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[40%] bg-gradient-to-b from-[hsl(var(--warm-50))] via-transparent to-transparent pointer-events-none" />
      <div className="relative w-full max-w-md flex flex-col items-center text-center">
        <img
          src={appLogo}
          alt="ChaseHQ logo"
          className="w-20 h-20 rounded-2xl mb-4 animate-fade-in shadow-sm"
          style={{ animationDelay: "0ms", animationFillMode: "both" }}
          onClick={handleDemoTap}
        />

        <p
          className="text-xs tracking-[0.12em] font-semibold text-primary mb-4 animate-fade-in"
          style={{ animationDelay: "60ms", animationFillMode: "both" }}
        >
          ChaseHQ
        </p>

        <h1
          className="text-[clamp(28px,7vw,40px)] font-bold text-foreground tracking-[-0.03em] leading-[1.05] animate-fade-in"
          style={{ animationDelay: "120ms", animationFillMode: "both" }}
        >
          Following up on payments<br />shouldn't feel this hard.
        </h1>

        <p
          className="mt-4 text-[16px] leading-[1.55] text-muted-foreground max-w-sm animate-fade-in"
          style={{ animationDelay: "320ms", animationFillMode: "both" }}
        >
          It does for most freelancers. You're not alone — and you're not wrong to dread it.
        </p>

        <div className="mt-10 w-full max-w-xs flex flex-col gap-2.5">
          <button
            onClick={() => sendFlow("START")}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 ease-out active:scale-[0.97] hover:bg-primary/90 animate-fade-in shadow-[0_8px_24px_rgba(91,123,142,0.25)] hover:shadow-[0_12px_32px_rgba(91,123,142,0.30)]"
            style={{ animationDelay: "520ms", animationFillMode: "both" }}
          >
            Stop Chasing. Start Getting Paid. <ArrowRight className="w-4 h-4" />
          </button>

          {!isDemoMode && (
            <button
              onClick={() => setSignInOpen(true)}
              className="w-full py-3 rounded-xl border border-border bg-card text-sm font-semibold text-foreground transition-all duration-200 ease-out active:scale-[0.97] hover:bg-muted animate-fade-in"
              style={{ animationDelay: "620ms", animationFillMode: "both" }}
            >
              Already have an account? Sign in
            </button>
          )}
        </div>
      </div>

      <GoogleAuthSheet
        open={signInOpen}
        onClose={() => setSignInOpen(false)}
        variant="sign_in"
        redirectPath="/"
      />
    </div>
  );
}
