import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { ArrowLeft } from "lucide-react";
import AuthForm from "@/components/auth/AuthForm";
import { STORAGE_KEYS } from "@/lib/storageKeys";

export default function AuthScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, hasCompletedOnboarding, authReady } = useApp();
  const mode: "signup" | "signin" = searchParams.get("mode") === "signup" ? "signup" : "signin";

  useEffect(() => {
    // Clear OAuth flag when we reach the auth screen (OAuth callback completed)
    sessionStorage.removeItem(STORAGE_KEYS.OAUTH_IN_PROGRESS);

    // Check for OAuth error
    const error = searchParams.get("error");
    const errorDesc = searchParams.get("error_description");

    if (error) {
      console.error("[AuthScreen] OAuth error:", error, errorDesc);
    } else {
      if (import.meta.env.DEV) console.log("[AuthScreen] Mounted - isAuthenticated:", isAuthenticated, "authReady:", authReady);
    }
  }, [searchParams, isAuthenticated, authReady]);

  useEffect(() => {
    if (!authReady) return;
    if (!isAuthenticated) {
      if (import.meta.env.DEV) console.log("[AuthScreen] Not authenticated - showing auth form");
      return;
    }
    if (import.meta.env.DEV) console.log("[AuthScreen] Authenticated - redirecting to", hasCompletedOnboarding ? "/dashboard" : "/onboarding");
    if (hasCompletedOnboarding) navigate("/dashboard", { replace: true });
    else navigate("/onboarding", { replace: true });
  }, [authReady, isAuthenticated, hasCompletedOnboarding, navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col animate-page-enter">
      <div className="flex-1 flex flex-col max-w-sm w-full mx-auto px-7 pt-10 pb-6">
        <button
          onClick={() => (window.history.length > 1 ? window.history.back() : navigate("/welcome"))}
          className="w-9 h-9 -ml-1 flex items-center justify-center text-foreground active:scale-95 transition-transform"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <h1 className="mt-10 text-[34px] font-bold text-foreground leading-[1.1] tracking-tight">
          {mode === "signup" ? <>Create<br />your account</> : <>Welcome<br />Back</>}
        </h1>
        <p className="mt-3 text-[14px] text-muted-foreground leading-relaxed mb-8">
          {mode === "signup"
            ? "Start recovering invoices in minutes."
            : "Your follow-ups are waiting — let's get those invoices paid."}
        </p>

        <AuthForm initialMode={mode} />
      </div>

      <p className="text-xs text-muted-foreground text-center pb-8 px-7">
        By continuing you agree to our{" "}
        <button onClick={() => navigate("/legal/terms")} className="underline hover:text-foreground">Terms</button>
        {" "}&amp;{" "}
        <button onClick={() => navigate("/legal/privacy")} className="underline hover:text-foreground">Privacy Policy</button>
      </p>
    </div>
  );
}
