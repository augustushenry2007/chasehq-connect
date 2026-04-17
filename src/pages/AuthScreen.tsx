import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { Check, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Mode = "signup" | "signin";

export default function AuthScreen() {
  const navigate = useNavigate();
  const { isAuthenticated, hasCompletedOnboarding, authReady } = useApp();
  const [mode, setMode] = useState<Mode>("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    if (!authReady || !isAuthenticated) return;
    if (hasCompletedOnboarding) navigate("/dashboard", { replace: true });
    else navigate("/onboarding", { replace: true });
  }, [authReady, isAuthenticated, hasCompletedOnboarding, navigate]);

  async function handleGoogle() {
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error("Google sign-in failed: " + result.error.message);
        setGoogleLoading(false);
        return;
      }
      if (result.redirected) return;
    } catch {
      toast.error("Google sign-in failed");
      setGoogleLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password || (mode === "signup" && !name.trim())) {
      toast.error("Please fill in all fields");
      return;
    }
    if (mode === "signup" && password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setSubmitLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name.trim() },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) {
          toast.error(error.message);
          setSubmitLoading(false);
          return;
        }
        toast.success("Account created");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          toast.error(error.message);
          setSubmitLoading(false);
          return;
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setSubmitLoading(false);
    }
  }

  const isSignup = mode === "signup";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col justify-center max-w-sm w-full mx-auto px-7 py-10">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-10 h-10 rounded-[12px] bg-primary flex items-center justify-center">
            <Check className="w-5 h-5 text-primary-foreground" strokeWidth={3} />
          </div>
          <span className="text-[18px] font-bold text-foreground">ChaseHQ</span>
        </div>

        {/* Headline */}
        <h1 className="text-[28px] font-bold text-foreground leading-[1.15] tracking-tight mb-2">
          {isSignup ? "Create your account" : "Welcome back"}
        </h1>
        <p className="text-[14px] text-muted-foreground leading-[20px] mb-7">
          {isSignup
            ? "Get paid without the awkwardness — ChaseHQ handles every follow-up for you."
            : "Sign in to keep your invoices on track."}
        </p>

        {/* Google */}
        <button
          onClick={handleGoogle}
          disabled={googleLoading || submitLoading}
          className="flex items-center justify-center gap-2.5 border border-border bg-card rounded-xl py-3 shadow-sm active:scale-[0.98] transition-transform mb-4 disabled:opacity-60"
        >
          {googleLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-foreground" />
          ) : (
            <div className="w-[20px] h-[20px] rounded-md bg-[#4285F4] flex items-center justify-center">
              <span className="text-[11px] font-bold text-white">G</span>
            </div>
          )}
          <span className="text-[14px] font-semibold text-foreground">
            Continue with Google
          </span>
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[12px] text-muted-foreground">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {isSignup && (
            <div>
              <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                className="w-full px-3.5 py-3 text-[14px] bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                autoComplete="name"
              />
            </div>
          )}
          <div>
            <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3.5 py-3 text-[14px] bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isSignup ? "At least 6 characters" : "Your password"}
                className="w-full px-3.5 py-3 pr-10 text-[14px] bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                autoComplete={isSignup ? "new-password" : "current-password"}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitLoading || googleLoading}
            className="mt-2 flex items-center justify-center gap-2 bg-primary rounded-xl py-3.5 active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {submitLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary-foreground" />
            ) : (
              <span className="text-[14px] font-semibold text-primary-foreground">
                {isSignup ? "Create account" : "Sign in"}
              </span>
            )}
          </button>
        </form>

        {/* Toggle */}
        <p className="text-center text-[13px] text-muted-foreground mt-6">
          {isSignup ? "Already have an account?" : "New to ChaseHQ?"}{" "}
          <button
            onClick={() => setMode(isSignup ? "signin" : "signup")}
            className="font-semibold text-primary hover:underline"
          >
            {isSignup ? "Sign in" : "Create an account"}
          </button>
        </p>
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
