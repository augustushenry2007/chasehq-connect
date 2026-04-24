import { useState } from "react";
import { startGoogleOAuth } from "@/lib/oauth";
import { GoogleIcon } from "@/components/GoogleIcon";
import { analytics } from "@/lib/analytics";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AuthFormProps {
  redirectTo?: string;
  initialMode?: "signup" | "signin";
  submitLabel?: { signup: string; signin: string };
  onSuccess?: () => void;
}

export default function AuthForm({
  redirectTo = window.location.origin,
  initialMode = "signup",
}: AuthFormProps) {
  const [googleLoading, setGoogleLoading] = useState(false);
  const isSignup = initialMode === "signup";

  async function handleGoogle() {
    setGoogleLoading(true);
    const safety = window.setTimeout(() => {
      setGoogleLoading(false);
      console.warn("[Google Auth] Request timed out after 30s");
    }, 30000);
    const { error } = await startGoogleOAuth(redirectTo);
    if (error) {
      analytics.error("google_oauth_failed", error.message, { mode: isSignup ? "signup" : "signin" });
      toast.error("Sign-in didn't go through. Give it another try.");
      setGoogleLoading(false);
      window.clearTimeout(safety);
      return;
    }
    analytics.track(isSignup ? "signup_google_initiated" : "signin_google_initiated", {});
  }

  return (
    <div className="flex flex-col">
      <button
        onClick={handleGoogle}
        disabled={googleLoading}
        className="w-full flex items-center justify-center gap-3 bg-card border border-border rounded-xl py-3.5 disabled:opacity-60 transition-all duration-200 ease-out active:scale-[0.97]"
      >
        {googleLoading ? (
          <Loader2 className="w-5 h-5 animate-spin text-foreground" />
        ) : (
          <>
            <GoogleIcon className="w-5 h-5" />
            <span className="text-sm font-medium text-foreground">
              {isSignup ? "Sign up with Google" : "Sign in with Google"}
            </span>
          </>
        )}
      </button>
    </div>
  );
}
