import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { ArrowLeft } from "lucide-react";
import AuthForm from "@/components/auth/AuthForm";

export default function AuthScreen() {
  const navigate = useNavigate();
  const { isAuthenticated, hasCompletedOnboarding, authReady } = useApp();

  useEffect(() => {
    if (!authReady || !isAuthenticated) return;
    if (hasCompletedOnboarding) navigate("/dashboard", { replace: true });
    else navigate("/onboarding", { replace: true });
  }, [authReady, isAuthenticated, hasCompletedOnboarding, navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col animate-page-enter">
      <div className="flex-1 flex flex-col max-w-sm w-full mx-auto px-7 pt-10 pb-6">
        <button
          onClick={() => (window.history.length > 1 ? window.history.back() : navigate("/"))}
          className="w-9 h-9 -ml-1 flex items-center justify-center text-foreground active:scale-95 transition-transform"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <h1 className="mt-10 text-[34px] font-bold text-foreground leading-[1.1] tracking-tight">
          Welcome<br />Back
        </h1>
        <p className="mt-3 text-[14px] text-muted-foreground leading-relaxed mb-8">
          Your follow-ups are waiting — let's get those invoices paid.
        </p>

        <AuthForm
          initialMode="signin"
          redirectTo={window.location.origin}
          submitLabel={{ signup: "Sign up", signin: "Sign in" }}
        />
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
