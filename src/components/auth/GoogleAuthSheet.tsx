import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useFlow } from "@/flow/FlowMachine";
import { startGoogleOAuth, OAUTH_USER_CANCELED } from "@/integrations/oauth";
import { GoogleIcon } from "@/components/GoogleIcon";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import type { FlowEvent } from "@/flow/transitions";

type Variant = "create_account" | "save_draft" | "send_invoice" | "resume_session" | "sign_in";

const COPY: Record<Variant, { headline: string; subhead: string }> = {
  create_account: {
    headline: "Create your free account",
    subhead: "ChaseHQ sends follow-ups for you — you review every message before it goes, and replies come straight back to you.",
  },
  save_draft: {
    headline: "Save your draft",
    subhead: "Sign in to keep this draft. You review every message; replies route back to your inbox.",
  },
  send_invoice: {
    headline: "Sign in to send",
    subhead: "ChaseHQ sends follow-ups for you. You review every message; replies come back to your inbox.",
  },
  resume_session: {
    headline: "Welcome back",
    subhead: "Pick up where you left off. You review every follow-up before it goes.",
  },
  sign_in: {
    headline: "Welcome back",
    subhead: "Sign in to pick up where you left off.",
  },
};

const DISCLAIMER =
  "By continuing, you create a ChaseHQ account using your Google sign-in. ChaseHQ sends follow-ups on your behalf — you review every message and replies come back to your inbox.";

interface GoogleAuthSheetProps {
  open: boolean;
  onClose: () => void;
  variant: Variant;
  flowEvent?: FlowEvent;
  redirectPath?: string;
  sendAfterAuth?: "send" | "generate";
}

export function GoogleAuthSheet({
  open,
  onClose,
  variant,
  flowEvent,
  redirectPath = "/auth-after-invoice",
  sendAfterAuth,
}: GoogleAuthSheetProps) {
  const { send } = useFlow();
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const { headline, subhead } = COPY[variant];

  const isSignInVariant = variant === "sign_in" || variant === "resume_session";

  async function handleContinue() {
    if (loading) return;
    setLoading(true);
    if (flowEvent) send(flowEvent);
    const intent = isSignInVariant ? "signIn" : "signUp";
    if (sendAfterAuth) {
      sessionStorage.setItem(STORAGE_KEYS.SEND_AFTER_AUTH, sendAfterAuth);
    }
    const blocker = document.getElementById("oauth-blocker") as HTMLElement | null;
    if (blocker) blocker.style.display = "block";
    onClose();
    const { error } = await startGoogleOAuth(window.location.origin + redirectPath, intent);
    if (error) {
      if (blocker) blocker.style.display = "none";
      if (error.code === OAUTH_USER_CANCELED) {
        if (sendAfterAuth) {
          sessionStorage.removeItem(STORAGE_KEYS.SEND_AFTER_AUTH);
        }
        setLoading(false);
        return;
      }
      toast.error("Sign-in didn't go through. Give it another try.");
      if (sendAfterAuth) {
        sessionStorage.removeItem(STORAGE_KEYS.SEND_AFTER_AUTH);
      }
      setLoading(false);
    }
    // On success, OAuthOverlay owns the blocker hide — it dismisses only after
    // auth+profile+navigation have all settled, so the destination route has painted.
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 animate-fade-in"
      onClick={() => !loading && onClose()}
    >
      <div
        className="w-full max-w-md bg-card rounded-t-3xl shadow-2xl p-6 pb-[max(env(safe-area-inset-bottom,16px),24px)] animate-slide-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto w-10 h-1 rounded-full bg-border mb-5" />
        <h2 className="text-lg font-bold text-foreground mb-1">{headline}</h2>
        <p className="text-sm text-muted-foreground mb-5">{subhead}</p>
        <button
          onClick={handleContinue}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-card border border-border rounded-xl py-3.5 disabled:opacity-60 transition-all duration-200 ease-out active:scale-[0.97]"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin text-foreground" />
          ) : (
            <>
              <GoogleIcon className="w-5 h-5" />
              <span className="text-sm font-medium text-foreground">Continue With Google</span>
            </>
          )}
        </button>
        <button
          onClick={onClose}
          disabled={loading}
          className="mt-3 w-full py-2.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
        >
          Maybe later
        </button>
        {isSignInVariant ? (
          <p className={`text-[11px] text-muted-foreground mt-3 leading-relaxed text-center transition-opacity ${loading ? "opacity-60" : ""}`}>
            Sign in with the Google account you used before.
          </p>
        ) : (
          <p className={`text-[11px] text-muted-foreground mt-3 leading-relaxed text-center transition-opacity ${loading ? "opacity-60" : ""}`}>
            {DISCLAIMER}
          </p>
        )}
        <p className="text-[11px] text-muted-foreground text-center mt-2">
          By continuing, you agree to our{" "}
          <Link to="/legal/terms" onClick={onClose} className="underline">Terms</Link> and{" "}
          <Link to="/legal/privacy" onClick={onClose} className="underline">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
