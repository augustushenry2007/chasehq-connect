import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { GoogleIcon } from "@/components/GoogleIcon";
import { validatePassword } from "@/lib/passwordValidation";
import { Loader2, Mail, Lock, User, Eye, EyeOff, Check, X } from "lucide-react";
import { toast } from "sonner";

type Mode = "signup" | "signin";

interface AuthFormProps {
  redirectTo?: string;
  initialMode?: Mode;
  submitLabel?: { signup: string; signin: string };
  onSuccess?: () => void;
}

export default function AuthForm({
  redirectTo = window.location.origin,
  initialMode = "signup",
  submitLabel = { signup: "Create account", signin: "Sign in" },
  onSuccess,
}: AuthFormProps) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  const isSignup = mode === "signup";
  const pwCheck = useMemo(() => validatePassword(password), [password]);
  const showPwRules = isSignup && (passwordTouched || password.length > 0);
  const canSubmit =
    !!email && !!password && (!isSignup || (name.trim().length > 0 && pwCheck.isValid));

  async function handleGoogle() {
    setGoogleLoading(true);
    const safety = window.setTimeout(() => setGoogleLoading(false), 30000);
    try {
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: redirectTo });
      if (result.error) {
        toast.error("Google sign-in failed: " + result.error.message);
        setGoogleLoading(false);
        window.clearTimeout(safety);
        return;
      }
      if (result.redirected) return;
      setGoogleLoading(false);
      window.clearTimeout(safety);
    } catch (e: any) {
      toast.error("Google sign-in failed" + (e?.message ? `: ${e.message}` : ""));
      setGoogleLoading(false);
      window.clearTimeout(safety);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) {
      if (isSignup && !pwCheck.isValid) setPasswordTouched(true);
      toast.error("Please fill in all fields");
      return;
    }
    setSubmitLoading(true);
    try {
      if (isSignup) {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: name.trim() }, emailRedirectTo: redirectTo },
        });
        if (error) { toast.error(error.message); setSubmitLoading(false); return; }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) { toast.error(error.message); setSubmitLoading(false); return; }
      }
      onSuccess?.();
      // onAuthStateChange will pick up the session globally.
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setSubmitLoading(false);
    }
  }

  return (
    <div className="flex flex-col">
      <button
        onClick={handleGoogle}
        disabled={googleLoading || submitLoading}
        className="w-full flex items-center justify-center gap-3 bg-card border border-border rounded-xl py-3 mb-4 disabled:opacity-60 transition-all duration-200 ease-out active:scale-[0.97]"
      >
        {googleLoading ? <Loader2 className="w-5 h-5 animate-spin text-foreground" /> : (
          <>
            <GoogleIcon className="w-5 h-5" />
            <span className="text-sm font-medium text-foreground">
              {isSignup ? "Sign up with Google" : "Sign in with Google"}
            </span>
          </>
        )}
      </button>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-border" />
        <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Or</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {isSignup && (
          <FieldWrap icon={<User className="w-4 h-4" />}>
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Full name" autoComplete="name"
              className="w-full bg-transparent pl-10 pr-3 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </FieldWrap>
        )}
        <FieldWrap icon={<Mail className="w-4 h-4" />}>
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="Email" autoComplete="email"
            className="w-full bg-transparent pl-10 pr-3 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </FieldWrap>
        <FieldWrap icon={<Lock className="w-4 h-4" />}>
          <input
            type={showPassword ? "text" : "password"} value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setPasswordTouched(true)}
            placeholder={isSignup ? "Create password" : "Password"}
            autoComplete={isSignup ? "new-password" : "current-password"}
            className="w-full bg-transparent pl-10 pr-10 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <button type="button" onClick={() => setShowPassword((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </FieldWrap>

        {showPwRules && (
          <ul className="flex flex-col gap-1 px-1" aria-live="polite">
            {pwCheck.results.map((r) => (
              <li key={r.id} className="flex items-center gap-1.5 text-[12px]">
                {r.passed ? <Check className="w-3.5 h-3.5 text-primary shrink-0" /> : <X className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                <span className={r.passed ? "text-foreground" : "text-muted-foreground"}>{r.label}</span>
              </li>
            ))}
          </ul>
        )}

        <button
          type="submit"
          disabled={submitLoading || googleLoading || (isSignup && !canSubmit)}
          className="mt-2 flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold text-sm disabled:opacity-50 transition-all duration-200 ease-out active:scale-[0.97]"
        >
          {submitLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isSignup ? submitLabel.signup : submitLabel.signin)}
        </button>
      </form>

      <p className="text-center text-xs text-muted-foreground mt-4">
        {isSignup ? "Already have an account?" : "New to ChaseHQ?"}{" "}
        <button
          onClick={() => { setMode(isSignup ? "signin" : "signup"); setPasswordTouched(false); }}
          className="font-semibold text-primary"
        >
          {isSignup ? "Sign in" : "Create one"}
        </button>
      </p>
    </div>
  );
}

function FieldWrap({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative border border-border bg-card rounded-xl focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>
      {children}
    </div>
  );
}
