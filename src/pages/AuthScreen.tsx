import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { Check, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function AuthScreen() {
  const navigate = useNavigate();
  const { isAuthenticated, hasCompletedOnboarding, authReady, restartOnboarding } = useApp();
  const [loading, setLoading] = useState(false);
  const [forceQuiz, setForceQuiz] = useState(false);

  useEffect(() => {
    if (!authReady || !isAuthenticated) return;
    if (forceQuiz) {
      navigate("/onboarding", { replace: true });
      return;
    }
    if (hasCompletedOnboarding) navigate("/dashboard", { replace: true });
    else navigate("/onboarding", { replace: true });
  }, [authReady, isAuthenticated, hasCompletedOnboarding, navigate, forceQuiz]);

  async function handleSignIn() {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error("Sign in failed: " + result.error.message);
        setLoading(false);
        return;
      }
      if (result.redirected) return;
    } catch {
      toast.error("Sign in failed");
    }
    setLoading(false);
  }

  async function handleQuiz() {
    // Sign in as demo and route directly to onboarding quiz
    setLoading(true);
    setForceQuiz(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: "demo@chasehq.app",
      password: "demo123456",
    });
    if (error) {
      const { error: signUpError } = await supabase.auth.signUp({
        email: "demo@chasehq.app",
        password: "demo123456",
      });
      if (signUpError) {
        toast.error("Failed: " + signUpError.message);
        setLoading(false);
        setForceQuiz(false);
        return;
      }
    }
    await restartOnboarding();
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col justify-center max-w-sm w-full mx-auto px-7 py-10">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-10">
          <div className="w-10 h-10 rounded-[12px] bg-primary flex items-center justify-center">
            <Check className="w-5 h-5 text-primary-foreground" strokeWidth={3} />
          </div>
          <span className="text-[18px] font-bold text-foreground">ChaseHQ</span>
        </div>

        {/* Headline */}
        <h1 className="text-[34px] font-bold text-foreground leading-[1.1] tracking-tight mb-4">
          Get paid without the awkwardness.
        </h1>
        <p className="text-[15px] text-muted-foreground leading-[22px] mb-8">
          ChaseHQ handles every follow-up — so you never have to worry about what to say, when to say it, or how.
        </p>

        {/* CTAs */}
        <button
          onClick={handleSignIn}
          disabled={loading}
          className="flex items-center justify-center gap-2.5 border border-border bg-card rounded-xl py-3.5 shadow-sm active:scale-[0.98] transition-transform mb-3"
        >
          <div className="w-[22px] h-[22px] rounded-md bg-[#4285F4] flex items-center justify-center">
            <span className="text-xs font-bold text-primary-foreground">G</span>
          </div>
          <span className="text-[15px] font-semibold text-foreground">
            {loading ? "Signing in…" : "Continue with Google"}
          </span>
        </button>

        <div className="flex items-center gap-3 my-2">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[13px] text-muted-foreground">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <button
          onClick={handleQuiz}
          disabled={loading}
          className="flex items-center justify-center gap-2 bg-primary rounded-xl py-3.5 active:scale-[0.98] transition-transform"
        >
          <span className="text-[15px] font-semibold text-primary-foreground">
            Start fresh — take the quiz
          </span>
          <ArrowRight className="w-4 h-4 text-primary-foreground" />
        </button>
      </div>

      <p className="text-xs text-muted-foreground text-center pb-8 px-7">
        By continuing you agree to our Terms &amp; Privacy Policy
      </p>
    </div>
  );
}
