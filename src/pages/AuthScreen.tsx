import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Eye, EyeOff, Loader2, Mail, Lock, User } from "lucide-react";
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
      <div className="flex-1 flex flex-col max-w-sm w-full mx-auto px-7 pt-10 pb-6">
        {/* Back */}
        <button
          onClick={() => (window.history.length > 1 ? window.history.back() : navigate("/"))}
          className="w-9 h-9 -ml-1 flex items-center justify-center text-foreground active:scale-95 transition-transform"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Headline */}
        <h1 className="mt-10 text-[34px] font-bold text-foreground leading-[1.1] tracking-tight">
          {isSignup ? (
            <>Create your<br />Account</>
          ) : (
            <>Welcome<br />Back</>
          )}
        </h1>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-10 flex flex-col gap-5">
          {isSignup && (
            <FloatingField label="Full name" icon={<User className="w-4 h-4" />}>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                className="w-full bg-transparent pl-10 pr-3 py-3.5 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none"
                autoComplete="name"
              />
            </FloatingField>
          )}

          <FloatingField label="Email address" icon={<Mail className="w-4 h-4" />}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-transparent pl-10 pr-3 py-3.5 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none"
              autoComplete="email"
            />
          </FloatingField>

          <FloatingField label="Password" icon={<Lock className="w-4 h-4" />}>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isSignup ? "At least 6 characters" : "Your password"}
              className="w-full bg-transparent pl-10 pr-10 py-3.5 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none"
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
          </FloatingField>

          <button
            type="submit"
            disabled={submitLoading || googleLoading}
            className="mt-4 flex items-center justify-center gap-2 bg-primary rounded-full py-4 active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {submitLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary-foreground" />
            ) : (
              <span className="text-[15px] font-semibold text-primary-foreground">
                {isSignup ? "Sign up" : "Sign in"}
              </span>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 mt-8">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[12px] text-muted-foreground">Or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Social row */}
        <div className="mt-6 flex items-center justify-center">
          <button
            onClick={handleGoogle}
            disabled={googleLoading || submitLoading}
            className="w-12 h-12 rounded-full border border-border bg-card flex items-center justify-center active:scale-95 transition-transform disabled:opacity-60"
            aria-label="Continue with Google"
          >
            {googleLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-foreground" />
            ) : (
              <span className="text-[15px] font-bold text-[#4285F4]">G</span>
            )}
          </button>
        </div>

        {/* Toggle */}
        <p className="text-center text-[13px] text-muted-foreground mt-8">
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

function FloatingField({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative border border-border bg-card rounded-xl focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary">
      <span className="absolute -top-2 left-3 px-1.5 bg-background text-[11px] font-medium text-muted-foreground">
        {label}
      </span>
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
        {icon}
      </span>
      {children}
    </div>
  );
}
