import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/context/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { FLOW_STORAGE_KEY } from "@/flow/states";
import appLogo from "@/assets/app-logo.png";

function useDemoTap() {
  const count = useRef(0);
  const last = useRef(0);
  return () => {
    const now = Date.now();
    if (now - last.current > 1500) count.current = 0;
    last.current = now;
    if (++count.current >= 7) {
      count.current = 0;
      const next = localStorage.getItem("chasehq_demo_mode") === "1" ? "0" : "1";
      localStorage.setItem("chasehq_demo_mode", next);
      // Force next boot to start at APP_LAUNCH so FlowBootstrap's demo branch fires;
      // otherwise the persisted LANDING state shortcuts straight back to /welcome.
      localStorage.removeItem(FLOW_STORAGE_KEY);
      window.location.reload();
    }
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_COOLDOWN_SEC = 60;
const REVIEWER_EMAIL = "appreview@chasehq.app";
// 123456 → active Pro subscription. 654321 → expired subscription (Apple
// guideline 2.1 requires demo of the full purchase flow). Both verified
// server-side in reviewer-signin; only the seed step differs.
const REVIEWER_CODES = new Set(["123456", "654321"]);

export default function WelcomeScreen() {
  const { isAuthenticated } = useApp();
  const navigate = useNavigate();
  const handleDemoTap = useDemoTap();
  const isDemoMode = localStorage.getItem("chasehq_demo_mode") === "1";

  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const verifyingRef = useRef(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const id = window.setInterval(() => {
      setResendCountdown((s) => Math.max(0, s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [resendCountdown]);

  if (isAuthenticated) return null;

  async function requestCode(targetEmail: string): Promise<boolean> {
    const trimmed = targetEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      toast.error("That doesn't look like a valid email address.");
      return false;
    }
    // App Review reviewer account: bypass the real OTP send (mailbox isn't
    // reachable). The fixed code is verified server-side in reviewer-signin.
    if (trimmed === REVIEWER_EMAIL) {
      setResendCountdown(RESEND_COOLDOWN_SEC);
      return true;
    }
    setSending(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: { shouldCreateUser: true },
      });
      if (error) {
        toast.error(error.message || "Couldn't send the code. Try again.");
        return false;
      }
      setResendCountdown(RESEND_COOLDOWN_SEC);
      return true;
    } catch (e) {
      toast.error("Network error. Check your connection and try again.");
      return false;
    } finally {
      setSending(false);
    }
  }

  async function handleContinue() {
    const ok = await requestCode(email);
    if (ok) {
      setStep("otp");
      setCode("");
    }
  }

  async function handleResend() {
    if (resendCountdown > 0 || sending) return;
    await requestCode(email);
  }

  async function handleVerify(token: string) {
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    setVerifying(true);
    try {
      const trimmedEmail = email.trim().toLowerCase();

      // App Review path: reviewer-signin completes verification server-side and returns
      // a full session. setSession() stores it locally and fires SIGNED_IN — no
      // client-side verifyOtp call needed.
      if (trimmedEmail === REVIEWER_EMAIL && REVIEWER_CODES.has(token)) {
        const { data, error: fnError } = await supabase.functions.invoke<{
          access_token: string;
          refresh_token: string;
        }>("reviewer-signin", { body: { email: trimmedEmail, code: token } });
        if (fnError || !data?.access_token) {
          toast.error("That code didn't work. Try again.");
          setCode("");
          verifyingRef.current = false;
          setVerifying(false);
          return;
        }
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });
        if (sessionError) {
          toast.error(sessionError.message || "Sign-in failed. Try again.");
          setCode("");
          verifyingRef.current = false;
          setVerifying(false);
        }
        return;
      }

      const { error } = await supabase.auth.verifyOtp({
        email: trimmedEmail,
        token,
        type: "email",
      });
      if (error) {
        toast.error(error.message || "That code didn't work. Try again.");
        setCode("");
        verifyingRef.current = false;
        setVerifying(false);
        return;
      }
      // Success — AppContext.onAuthStateChange will pick up SIGNED_IN; FlowBootstrap
      // routes us to onboarding (fresh signup) or dashboard (returning user).
      // Leave verifying=true so the spinner sticks through the route transition.
    } catch {
      toast.error("Network error. Try again.");
      setCode("");
      verifyingRef.current = false;
      setVerifying(false);
    }
  }

  function handleEditEmail() {
    setStep("email");
    setCode("");
    setResendCountdown(0);
  }

  return (
    <div className="relative h-screen bg-background flex flex-col items-center justify-center px-6 overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[40%] bg-gradient-to-b from-[hsl(var(--warm-50))] via-transparent to-transparent pointer-events-none" />
      <div className="relative w-full max-w-md flex flex-col items-center text-center">
        <img
          src={appLogo}
          alt="ChaseHQ logo"
          role="button"
          aria-label="ChaseHQ logo"
          // cursor-pointer + role=button is what makes iOS WKWebView deliver
          // click events reliably to non-interactive <img> elements — without
          // these, the 7-tap demo-mode gesture silently drops taps.
          className="w-20 h-20 rounded-2xl mb-4 animate-fade-in shadow-sm cursor-pointer"
          style={{ animationDelay: "0ms", animationFillMode: "both" }}
          onClick={handleDemoTap}
        />

        <p
          className="text-xs tracking-[0.12em] font-semibold text-primary mb-4 animate-fade-in"
          style={{ animationDelay: "60ms", animationFillMode: "both" }}
        >
          ChaseHQ
        </p>

        {step === "email" ? (
          <>
            <h1
              className="text-[clamp(28px,7vw,40px)] font-bold text-foreground tracking-[-0.03em] leading-[1.05] animate-fade-in"
              style={{ animationDelay: "120ms", animationFillMode: "both" }}
            >
              Stop chasing.<br />Start getting paid.
            </h1>

            <p
              className="mt-4 text-[16px] leading-[1.55] text-muted-foreground max-w-sm animate-fade-in"
              style={{ animationDelay: "320ms", animationFillMode: "both" }}
            >
              Enter your email to get started. We'll send you a 6-digit code — no password needed.
            </p>

            <form
              className="mt-8 w-full max-w-xs flex flex-col gap-2.5 animate-fade-in"
              style={{ animationDelay: "520ms", animationFillMode: "both" }}
              onSubmit={(e) => { e.preventDefault(); if (!sending) void handleContinue(); }}
            >
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={sending}
                className="w-full px-4 py-3.5 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring transition-all disabled:opacity-60"
              />

              <button
                type="submit"
                disabled={sending || !email.trim()}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 ease-out active:scale-[0.97] hover:bg-primary/90 disabled:opacity-60 shadow-[0_8px_24px_rgba(91,123,142,0.25)] hover:shadow-[0_12px_32px_rgba(91,123,142,0.30)]"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>Continue <ArrowRight className="w-4 h-4" /></>
                )}
              </button>

              {!isDemoMode && (
                <p className="text-[11px] text-muted-foreground/80 mt-1 leading-snug">
                  By continuing, you agree to our{" "}
                  <button onClick={() => navigate("/legal/terms")} className="underline">Terms</button>{" "}
                  and{" "}
                  <button onClick={() => navigate("/legal/privacy")} className="underline">Privacy Policy</button>.
                </p>
              )}
            </form>
          </>
        ) : (
          <>
            <h1
              className="text-[clamp(24px,6vw,32px)] font-bold text-foreground tracking-[-0.03em] leading-[1.1] animate-fade-in"
              style={{ animationDelay: "0ms", animationFillMode: "both" }}
            >
              Check your email
            </h1>

            <p
              className="mt-3 text-[15px] leading-[1.55] text-muted-foreground max-w-sm animate-fade-in"
              style={{ animationDelay: "60ms", animationFillMode: "both" }}
            >
              We sent a 6-digit code to<br />
              <span className="font-medium text-foreground">{email.trim().toLowerCase()}</span>
            </p>

            <div
              className="mt-7 flex justify-center animate-fade-in"
              style={{ animationDelay: "120ms", animationFillMode: "both" }}
            >
              <InputOTP
                maxLength={6}
                value={code}
                onChange={(v) => {
                  setCode(v);
                  if (v.length === 6) void handleVerify(v);
                }}
                disabled={verifying}
                autoFocus
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} className="w-12 h-14 text-lg" />
                  <InputOTPSlot index={1} className="w-12 h-14 text-lg" />
                  <InputOTPSlot index={2} className="w-12 h-14 text-lg" />
                  <InputOTPSlot index={3} className="w-12 h-14 text-lg" />
                  <InputOTPSlot index={4} className="w-12 h-14 text-lg" />
                  <InputOTPSlot index={5} className="w-12 h-14 text-lg" />
                </InputOTPGroup>
              </InputOTP>
            </div>

            {verifying && (
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground animate-fade-in">
                <Loader2 className="w-4 h-4 animate-spin" />
                Verifying…
              </div>
            )}

            <div
              className="mt-8 w-full max-w-xs flex flex-col gap-2 animate-fade-in"
              style={{ animationDelay: "180ms", animationFillMode: "both" }}
            >
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCountdown > 0 || sending || verifying}
                className="w-full py-2.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
              >
                {sending ? "Sending…" : resendCountdown > 0 ? `Resend code in ${resendCountdown}s` : "Didn't get it? Resend code"}
              </button>
              <button
                type="button"
                onClick={handleEditEmail}
                disabled={verifying}
                className="w-full py-2 text-xs text-muted-foreground/80 hover:text-foreground disabled:opacity-50 transition-colors"
              >
                Wrong email? Edit
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
