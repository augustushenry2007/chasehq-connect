import { useEffect, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { useFlow } from "@/flow/FlowMachine";
import { useApp } from "@/context/AppContext";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import { GoogleAuthSheet } from "@/components/auth/GoogleAuthSheet";
import appLogo from "@/assets/app-logo.png";

function AuthHydratingSplash() {
  return (
    <div className="h-screen bg-background flex flex-col items-center justify-center px-6 overflow-hidden">
      <img src={appLogo} alt="ChaseHQ logo" className="w-20 h-20 rounded-2xl mb-4 shadow-sm" />
      <p className="text-sm font-bold tracking-[0.18em] text-primary mb-5">ChaseHQ</p>
      <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
    </div>
  );
}

interface NoAccountScreenProps {
  onSignUp: () => void;
  onCancel: () => void;
}

function NoAccountScreen({ onSignUp, onCancel }: NoAccountScreenProps) {
  return (
    <div className="h-screen bg-background flex flex-col items-center justify-center px-6 overflow-hidden">
      <div className="w-full max-w-md flex flex-col items-center text-center">
        <img
          src={appLogo}
          alt="ChaseHQ logo"
          className="w-20 h-20 rounded-2xl mb-4 animate-fade-in shadow-sm"
          style={{ animationDelay: "0ms", animationFillMode: "both" }}
        />
        <p
          className="text-sm font-bold tracking-[0.18em] text-primary mb-5 animate-fade-in"
          style={{ animationDelay: "60ms", animationFillMode: "both" }}
        >
          ChaseHQ
        </p>
        <h1
          className="text-[24px] leading-[1.2] font-bold text-foreground tracking-tight animate-fade-in"
          style={{ animationDelay: "120ms", animationFillMode: "both" }}
        >
          You don't have an account yet
        </h1>
        <p
          className="mt-4 text-base text-muted-foreground leading-relaxed max-w-sm animate-fade-in"
          style={{ animationDelay: "240ms", animationFillMode: "both" }}
        >
          That Google account isn't connected to ChaseHQ. Sign up to get started — it only takes a minute.
        </p>
        <button
          onClick={onSignUp}
          className="mt-10 w-full max-w-xs flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 ease-out active:scale-[0.97] hover:bg-primary/90 animate-fade-in"
          style={{ animationDelay: "440ms", animationFillMode: "both" }}
        >
          Sign up instead <ArrowRight className="w-4 h-4" />
        </button>
        <button
          onClick={onCancel}
          className="mt-4 w-full max-w-xs py-3 rounded-xl border border-border bg-card text-sm font-semibold text-foreground transition-all duration-200 ease-out active:scale-[0.97] hover:bg-muted animate-fade-in"
          style={{ animationDelay: "540ms", animationFillMode: "both" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function WelcomeScreen() {
  const { send: sendFlow } = useFlow();
  const { isAuthenticated } = useApp();

  const [oauthLatched, setOauthLatched] = useState(() =>
    typeof window !== "undefined" && (
      sessionStorage.getItem(STORAGE_KEYS.OAUTH_IN_PROGRESS) === "1" ||
      sessionStorage.getItem(STORAGE_KEYS.OAUTH_COMPLETED) === "1"
    )
  );
  const [signInOpen, setSignInOpen] = useState(false);
  const [showNoAccount, setShowNoAccount] = useState(() =>
    typeof window !== "undefined" &&
    sessionStorage.getItem(STORAGE_KEYS.NO_ACCOUNT_DETECTED) === "1"
  );

  useEffect(() => {
    const handler = () => {
      const inProgress = sessionStorage.getItem(STORAGE_KEYS.OAUTH_IN_PROGRESS) === "1";
      const completed = sessionStorage.getItem(STORAGE_KEYS.OAUTH_COMPLETED) === "1";
      if (inProgress || completed) setOauthLatched(true);
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
    }, 12000);
    return () => window.clearTimeout(t);
  }, [oauthLatched, isAuthenticated]);

  useEffect(() => {
    const handler = () => {
      setOauthLatched(false);
      setSignInOpen(false);
      setShowNoAccount(true);
      // Also written to sessionStorage by AppContext before this event fires,
      // but set here too so the flag stays consistent if WelcomeScreen is already mounted.
      sessionStorage.setItem(STORAGE_KEYS.NO_ACCOUNT_DETECTED, "1");
    };
    window.addEventListener("chasehq:no-account", handler);
    return () => window.removeEventListener("chasehq:no-account", handler);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      const inProgress = sessionStorage.getItem(STORAGE_KEYS.OAUTH_IN_PROGRESS) === "1";
      const completed = sessionStorage.getItem(STORAGE_KEYS.OAUTH_COMPLETED) === "1";
      if (!inProgress && !completed) setOauthLatched(false);
    }
  }, [isAuthenticated]);

  if (oauthLatched || isAuthenticated) {
    return <AuthHydratingSplash />;
  }

  if (showNoAccount) {
    return (
      <NoAccountScreen
        onSignUp={() => {
          sessionStorage.removeItem(STORAGE_KEYS.NO_ACCOUNT_DETECTED);
          setShowNoAccount(false);
          sendFlow("START");
        }}
        onCancel={() => {
          sessionStorage.removeItem(STORAGE_KEYS.NO_ACCOUNT_DETECTED);
          setShowNoAccount(false);
        }}
      />
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col items-center justify-center px-6 overflow-hidden">
      <div className="w-full max-w-md flex flex-col items-center text-center">
        <img
          src={appLogo}
          alt="ChaseHQ logo"
          className="w-20 h-20 rounded-2xl mb-4 animate-fade-in shadow-sm"
          style={{ animationDelay: "0ms", animationFillMode: "both" }}
        />

        <p
          className="text-sm font-bold tracking-[0.18em] text-primary mb-5 animate-fade-in"
          style={{ animationDelay: "60ms", animationFillMode: "both" }}
        >
          ChaseHQ
        </p>

        <h1
          className="text-[28px] leading-[1.15] font-bold text-foreground tracking-tight animate-fade-in"
          style={{ animationDelay: "120ms", animationFillMode: "both" }}
        >
          Following up on payments<br />shouldn't feel this hard.
        </h1>

        <p
          className="mt-4 text-base text-muted-foreground leading-relaxed max-w-sm animate-fade-in"
          style={{ animationDelay: "320ms", animationFillMode: "both" }}
        >
          It does for most freelancers. You're not alone — and you're not wrong to dread it.
        </p>

        <button
          onClick={() => sendFlow("START")}
          className="mt-10 w-full max-w-xs flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 ease-out active:scale-[0.97] hover:bg-primary/90 animate-fade-in"
          style={{ animationDelay: "520ms", animationFillMode: "both" }}
        >
          Stop Chasing. Start Getting Paid. <ArrowRight className="w-4 h-4" />
        </button>

        <button
          onClick={() => setSignInOpen(true)}
          className="mt-4 w-full max-w-xs py-3 rounded-xl border border-border bg-card text-sm font-semibold text-foreground transition-all duration-200 ease-out active:scale-[0.97] hover:bg-muted animate-fade-in"
          style={{ animationDelay: "620ms", animationFillMode: "both" }}
        >
          Already have an account? Sign in
        </button>
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
