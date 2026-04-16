import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { Check, Zap, Shield, TrendingUp } from "lucide-react";
import { toast } from "sonner";

export default function AuthScreen() {
  const navigate = useNavigate();
  const { isAuthenticated } = useApp();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate("/dashboard", { replace: true });
  }, [isAuthenticated]);

  async function handleSignIn() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: "demo@chasehq.app",
      password: "demo123456",
    });
    if (error) {
      // If demo user doesn't exist, create it
      const { error: signUpError } = await supabase.auth.signUp({
        email: "demo@chasehq.app",
        password: "demo123456",
      });
      if (signUpError) {
        toast.error("Sign in failed: " + signUpError.message);
        setLoading(false);
        return;
      }
    }
    setLoading(false);
    // Auth state change in AppContext will handle navigation
  }

  async function handleExplore() {
    // For explore mode, use the same demo account
    await handleSignIn();
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center overflow-auto">
      <div className="w-full max-w-sm px-7 py-10">
        <div className="w-12 h-12 rounded-[14px] bg-primary flex items-center justify-center mb-2.5">
          <Check className="w-5.5 h-5.5 text-primary-foreground" />
        </div>
        <h1 className="text-[22px] font-bold text-foreground mb-8">ChaseHQ</h1>

        <div className="mb-7">
          <h2 className="text-[28px] font-bold text-foreground leading-9 mb-3">
            Get paid without the awkwardness.
          </h2>
          <p className="text-[15px] text-muted-foreground leading-[22px]">
            ChaseHQ handles every follow-up — so you never have to worry about what to say, when to say it, or how.
          </p>
        </div>

        <div className="flex flex-col gap-3 mb-8">
          {[
            { icon: Zap, text: "Automated follow-up sequences" },
            { icon: Shield, text: "Your voice, your brand — always" },
            { icon: TrendingUp, text: "Get paid faster, stress less" },
          ].map((f) => (
            <div key={f.text} className="flex items-center gap-3">
              <div className="w-[30px] h-[30px] rounded-lg bg-accent flex items-center justify-center shrink-0">
                <f.icon className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">{f.text}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 mb-5">
          <button
            onClick={handleSignIn}
            disabled={loading}
            className="flex items-center justify-center gap-2.5 border-[1.5px] border-border bg-card rounded-xl py-3.5 shadow-sm active:scale-[0.98] transition-transform"
          >
            <div className="w-[22px] h-[22px] rounded-full bg-[#4285F4] flex items-center justify-center">
              <span className="text-xs font-bold text-primary-foreground">G</span>
            </div>
            <span className="text-[15px] font-semibold text-foreground">
              {loading ? "Signing in…" : "Continue with Google"}
            </span>
          </button>

          <div className="flex items-center gap-2.5">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[13px] text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <button
            onClick={handleExplore}
            className="border-[1.5px] border-border rounded-xl py-3.5 text-center active:scale-[0.98] transition-transform"
          >
            <span className="text-sm font-medium text-muted-foreground">Explore without signing in</span>
          </button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          By continuing, you agree to our Privacy Policy.
        </p>
      </div>
    </div>
  );
}
