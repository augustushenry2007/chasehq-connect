import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ArrowLeft, Check, Clock, Mail, Loader2, Lock, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/context/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { GoogleIcon } from "@/components/GoogleIcon";
import { savePendingInvoice, persistPendingInvoice, clearPendingInvoice } from "@/lib/pendingInvoice";
import { validatePassword } from "@/lib/passwordValidation";

type Tone = "Polite" | "Friendly" | "Firm" | "Urgent";
type Step = "landing" | "qualify" | "details" | "magic" | "auth" | "done";

const TONES: Tone[] = ["Polite", "Friendly", "Firm", "Urgent"];

function buildMessage(client: string, amount: number, dueDate: string, tone: Tone) {
  const name = client?.trim() || "there";
  const amt = amount ? `$${amount.toLocaleString()}` : "the invoice";
  const due = dueDate ? new Date(dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "recently";

  switch (tone) {
    case "Polite":
      return {
        subject: `Quick check-in on ${amt}`,
        message: `Hi ${name}, hope you're doing well. Just gently checking in on the invoice from ${due} — let me know if anything needs clarifying on my end.`,
      };
    case "Firm":
      return {
        subject: `Following up: ${amt} due ${due}`,
        message: `Hi ${name}, I'm following up on the ${amt} invoice that was due ${due}. Could you confirm when payment will be sent? Happy to resend any details you need.`,
      };
    case "Urgent":
      return {
        subject: `Action needed: ${amt} overdue`,
        message: `Hi ${name}, the ${amt} invoice from ${due} is now overdue. Please let me know today when I can expect payment, or reach out if there's an issue I can help resolve.`,
      };
    case "Friendly":
    default:
      return {
        subject: `Just checking in on the invoice`,
        message: `Hey ${name}, just checking in on the invoice from ${due}. Let me know if you need anything from my end — happy to help.`,
      };
  }
}

export default function OnboardingScreen() {
  const navigate = useNavigate();
  const { isAuthenticated, hasCompletedOnboarding, completeOnboarding, user } = useApp();

  const [step, setStep] = useState<Step>("landing");

  // Demo invoice
  const [client, setClient] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [tone, setTone] = useState<Tone>("Friendly");
  const [hasInvoice, setHasInvoice] = useState<boolean | null>(null);

  // Auth (post-magic)
  const [authMode, setAuthMode] = useState<"signup" | "signin">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [persisting, setPersisting] = useState(false);

  // If already signed-in & onboarded, kick to dashboard.
  useEffect(() => {
    if (isAuthenticated && hasCompletedOnboarding) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, hasCompletedOnboarding, navigate]);

  // After signup/signin during onboarding, persist demo invoice + finish.
  useEffect(() => {
    if (step !== "auth" || !user) return;
    let cancelled = false;
    (async () => {
      setPersisting(true);
      try {
        await persistPendingInvoice(user.id);
        await completeOnboarding();
      } finally {
        if (!cancelled) {
          setPersisting(false);
          setStep("done");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [step, user, completeOnboarding]);

  const draft = useMemo(() => {
    const amt = parseFloat(amount) || 0;
    return buildMessage(client || "Alex", amt, dueDate, tone);
  }, [client, amount, dueDate, tone]);

  const detailsValid = client.trim().length > 0 && parseFloat(amount) > 0 && !!dueDate;

  function goLandingNext() { setStep("qualify"); }
  function goQualify(answer: boolean) {
    setHasInvoice(answer);
    if (answer) setStep("details");
    else {
      // Pre-fill a sample so the magic moment still works
      setClient("Alex");
      setAmount("1200");
      const d = new Date(); d.setDate(d.getDate() - 5);
      setDueDate(d.toISOString().slice(0, 10));
      setStep("magic");
    }
  }
  function goDetailsNext() {
    if (!detailsValid) return;
    setStep("magic");
  }

  function handleSendNow() {
    // Stash the demo for post-auth persistence, then prompt sign-in.
    const amt = parseFloat(amount) || 0;
    savePendingInvoice({
      client: client.trim() || "Alex",
      amount: amt,
      dueDate: dueDate || new Date().toISOString().slice(0, 10),
      tone,
      message: draft.message,
      subject: draft.subject,
    });
    setStep("auth");
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (result.error) {
        toast.error("Google sign-in failed: " + result.error.message);
        setGoogleLoading(false);
      }
    } catch {
      toast.error("Google sign-in failed");
      setGoogleLoading(false);
    }
  }

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password || (authMode === "signup" && !name.trim())) {
      toast.error("Please fill in all fields");
      return;
    }
    if (authMode === "signup" && !validatePassword(password).isValid) {
      toast.error("Password doesn't meet requirements");
      return;
    }
    setAuthLoading(true);
    try {
      if (authMode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: name.trim() }, emailRedirectTo: window.location.origin },
        });
        if (error) { toast.error(error.message); setAuthLoading(false); return; }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) { toast.error(error.message); setAuthLoading(false); return; }
      }
      // Effect above will pick up `user` and persist + advance.
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setAuthLoading(false);
    }
  }

  function handleFinish() {
    clearPendingInvoice();
    navigate("/dashboard", { replace: true });
  }

  // ------- Renders -------

  if (step === "landing") {
    return (
      <Shell>
        <div className="flex-1 flex flex-col justify-center text-center px-2">
          <h1 className="text-[34px] font-bold text-foreground leading-[1.1] tracking-tight">
            Following up on payments<br />shouldn't feel this hard.
          </h1>
          <p className="mt-5 text-[15px] text-muted-foreground leading-relaxed">
            We'll handle what to say, how to say it, and when to send.
          </p>
        </div>
        <div className="pb-2">
          <PrimaryButton onClick={goLandingNext}>Start</PrimaryButton>
          <p className="text-center text-[12px] text-muted-foreground mt-3">Takes ~60 seconds</p>
        </div>
      </Shell>
    );
  }

  if (step === "qualify") {
    return (
      <Shell onBack={() => setStep("landing")}>
        <div className="flex-1 flex flex-col justify-center">
          <h2 className="text-[26px] font-bold text-foreground leading-tight tracking-tight">
            Do you have a payment you're waiting on right now?
          </h2>
          <p className="mt-3 text-[14px] text-muted-foreground">
            We'll use this to set up your first follow-up.
          </p>
          <div className="mt-8 flex flex-col gap-3">
            <ChoiceButton onClick={() => goQualify(true)}>Yes, I do</ChoiceButton>
            <ChoiceButton onClick={() => goQualify(false)} variant="ghost">Not right now</ChoiceButton>
          </div>
        </div>
      </Shell>
    );
  }

  if (step === "details") {
    return (
      <Shell onBack={() => setStep("qualify")}>
        <div className="flex-1 flex flex-col">
          <h2 className="text-[26px] font-bold text-foreground leading-tight tracking-tight">Let's set it up</h2>
          <p className="mt-2 text-[14px] text-muted-foreground">A few quick details — no signup needed.</p>

          <div className="mt-7 flex flex-col gap-4">
            <Field label="Client name">
              <input
                value={client} onChange={(e) => setClient(e.target.value)}
                placeholder="e.g. Acme Inc."
                className="w-full bg-transparent px-3.5 py-3.5 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </Field>
            <Field label="Amount (USD)">
              <input
                type="number" inputMode="decimal" value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1200"
                className="w-full bg-transparent px-3.5 py-3.5 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </Field>
            <Field label="Due date">
              <input
                type="date" value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-transparent px-3.5 py-3.5 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </Field>
          </div>
        </div>
        <PrimaryButton onClick={goDetailsNext} disabled={!detailsValid}>
          Create follow-up
        </PrimaryButton>
      </Shell>
    );
  }

  if (step === "magic") {
    return (
      <Shell onBack={() => setStep(hasInvoice ? "details" : "qualify")}>
        <div className="flex-1 flex flex-col overflow-y-auto">
          <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">Ready to send</span>
          <h2 className="mt-1 text-[24px] font-bold text-foreground leading-tight tracking-tight">
            Here's your follow-up
          </h2>

          {/* Tone selector */}
          <div className="mt-5 flex gap-2 flex-wrap">
            {TONES.map((t) => (
              <button
                key={t}
                onClick={() => setTone(t)}
                className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold border transition-colors ${
                  tone === t ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Message card */}
          <div className="mt-4 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 pb-3 border-b border-border">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <p className="text-[12px] font-medium text-muted-foreground truncate">{draft.subject}</p>
            </div>
            <p className="mt-3 text-[14px] text-foreground leading-relaxed whitespace-pre-wrap">
              {draft.message}
            </p>
          </div>

          {/* System promise */}
          <div className="mt-4 flex items-start gap-2.5 p-3 rounded-xl bg-accent/50 border border-accent">
            <Clock className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="text-[12.5px] text-foreground leading-relaxed">
              If there's no reply, we'll follow up again in <strong>3 days</strong> — slightly firmer.
            </p>
          </div>
        </div>
        <PrimaryButton onClick={handleSendNow}>Send now</PrimaryButton>
      </Shell>
    );
  }

  if (step === "auth") {
    const isSignup = authMode === "signup";
    return (
      <Shell onBack={persisting ? undefined : () => setStep("magic")}>
        {persisting ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
            <p className="mt-4 text-[14px] text-muted-foreground">Sending your follow-up…</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-y-auto">
            <h2 className="text-[24px] font-bold text-foreground leading-tight tracking-tight">
              One quick step before we send
            </h2>
            <p className="mt-2 text-[14px] text-muted-foreground">
              Create your account so we can send this from your email and track replies.
            </p>

            <button
              onClick={handleGoogle}
              disabled={googleLoading || authLoading}
              className="mt-6 w-full flex items-center justify-center gap-3 bg-card border border-border rounded-full py-3.5 active:scale-[0.98] transition-transform disabled:opacity-60"
            >
              {googleLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <GoogleIcon className="w-5 h-5" />}
              <span className="text-[14px] font-medium text-foreground">
                {isSignup ? "Continue with Google" : "Sign in with Google"}
              </span>
            </button>

            <div className="flex items-center gap-3 mt-6">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[11px] text-muted-foreground">or with email</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <form onSubmit={handleEmailAuth} className="mt-5 flex flex-col gap-3">
              {isSignup && (
                <Field label="Full name" icon={<UserIcon className="w-4 h-4" />}>
                  <input
                    value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name" autoComplete="name"
                    className="w-full bg-transparent pl-10 pr-3 py-3.5 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none"
                  />
                </Field>
              )}
              <Field label="Email" icon={<Mail className="w-4 h-4" />}>
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com" autoComplete="email"
                  className="w-full bg-transparent pl-10 pr-3 py-3.5 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              </Field>
              <Field label="Password" icon={<Lock className="w-4 h-4" />}>
                <input
                  type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder={isSignup ? "Create a strong password" : "Your password"}
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  className="w-full bg-transparent pl-10 pr-3 py-3.5 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              </Field>

              <button
                type="submit"
                disabled={authLoading}
                className="mt-2 flex items-center justify-center gap-2 bg-primary rounded-full py-3.5 active:scale-[0.98] transition-transform disabled:opacity-50"
              >
                {authLoading
                  ? <Loader2 className="w-4 h-4 animate-spin text-primary-foreground" />
                  : <span className="text-[14px] font-semibold text-primary-foreground">
                      {isSignup ? "Create account & send" : "Sign in & send"}
                    </span>}
              </button>
            </form>

            <p className="text-center text-[12px] text-muted-foreground mt-5">
              {isSignup ? "Already have an account?" : "New to ChaseHQ?"}{" "}
              <button
                onClick={() => setAuthMode(isSignup ? "signin" : "signup")}
                className="font-semibold text-primary hover:underline"
              >
                {isSignup ? "Sign in" : "Create one"}
              </button>
            </p>
          </div>
        )}
      </Shell>
    );
  }

  // step === "done"
  return (
    <Shell>
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-5">
          <Check className="w-8 h-8 text-primary-foreground" />
        </div>
        <h2 className="text-[26px] font-bold text-foreground leading-tight tracking-tight">Sent</h2>
        <p className="mt-3 text-[14px] text-muted-foreground max-w-xs">
          We'll handle the next follow-up if needed.
        </p>
      </div>
      <PrimaryButton onClick={handleFinish}>Go to dashboard</PrimaryButton>
    </Shell>
  );
}

/* ---------- Small UI atoms ---------- */

function Shell({ children, onBack }: { children: React.ReactNode; onBack?: () => void }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col max-w-sm w-full mx-auto px-7 pt-[max(env(safe-area-inset-top),24px)] pb-[max(env(safe-area-inset-bottom),24px)]">
        {onBack && (
          <button
            onClick={onBack}
            className="w-9 h-9 -ml-1 mb-2 flex items-center justify-center text-foreground active:scale-95 transition-transform"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="mt-5 w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-4 rounded-full font-semibold text-[15px] active:scale-[0.98] transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
      {!disabled && <ArrowRight className="w-4 h-4" />}
    </button>
  );
}

function ChoiceButton({ children, onClick, variant = "solid" }: { children: React.ReactNode; onClick: () => void; variant?: "solid" | "ghost" }) {
  if (variant === "ghost") {
    return (
      <button
        onClick={onClick}
        className="w-full py-4 rounded-full font-semibold text-[15px] text-foreground border border-border bg-card active:scale-[0.98] transition-transform"
      >
        {children}
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      className="w-full py-4 rounded-full font-semibold text-[15px] bg-primary text-primary-foreground active:scale-[0.98] transition-transform"
    >
      {children}
    </button>
  );
}

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative border border-border bg-card rounded-xl focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary">
      <span className="absolute -top-2 left-3 px-1.5 bg-background text-[11px] font-medium text-muted-foreground">
        {label}
      </span>
      {icon && (
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
          {icon}
        </span>
      )}
      {children}
    </div>
  );
}
