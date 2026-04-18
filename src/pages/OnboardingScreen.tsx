import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { isTestingMode } from "@/lib/testingMode";
import { markGuestOnboarded } from "@/lib/localInvoice";
import { useFlow } from "@/flow/FlowMachine";
import {
  ChevronLeft, ChevronRight, ArrowRight, Check, Mail, Clock, Zap, Sparkles,
  AlertCircle, Loader2, Shield,
} from "lucide-react";

// Note: the post-auth "You're in" decision lives at /pre-dashboard, driven by the FlowMachine.

const Q0 = {
  label: "Just checking in",
  question: "When it comes to money conversations, I feel…",
  sub: "Select all that apply, or add your own.",
  placeholder: "e.g. stressed, resentful, powerless…",
  options: [
    { id: "anxious", label: "Anxious", detail: "I overthink every interaction and second-guess myself" },
    { id: "guilty", label: "Guilty", detail: "Like I shouldn't be asking for what I'm already owed" },
    { id: "frustrated", label: "Frustrated", detail: "It's exhausting and draining to deal with every time" },
  ],
};

const Q1 = {
  label: "A little more",
  question: "When I think about sending a follow-up…",
  sub: "Tick everything that rings true, or describe it yourself.",
  placeholder: "e.g. I freeze up, I feel embarrassed…",
  options: [
    { id: "hesitant", label: "I hesitate", detail: "I draft it five times and then don't send any of them" },
    { id: "relationship", label: "I worry", detail: "What if it damages the relationship or makes me look desperate?" },
    { id: "procrastinate", label: "I put it off", detail: "Until it's awkward to bring up and I've lost the moment" },
  ],
};

const Q2 = {
  label: "Last one",
  question: "What would actually make this easier?",
  sub: "Choose as many as feel right, or say it your way.",
  placeholder: "e.g. templates, a nudge, less guilt…",
  options: [
    { id: "words", label: "The right words", detail: "Already written — so I never stare at a blank screen again" },
    { id: "timing", label: "The right moment", detail: "Knowing exactly when to reach out without overthinking it" },
    { id: "automation", label: "Full automation", detail: "Set it and forget it — no manual effort from me at all" },
  ],
};

// Steps: 0,1,2 questions · 3 made-for-you · 4 how it works · 5 pricing/trial (final, no auth in onboarding)
const TOTAL_STEPS = 6;
const STORAGE_KEY = "onboarding_state";

function MultiSelectStep({ config, selected, onToggle, customText, setCustomText }: {
  config: typeof Q0; selected: Set<string>; onToggle: (id: string) => void; customText: string; setCustomText: (s: string) => void;
}) {
  return (
    <div>
      <span className="text-xs font-semibold text-primary uppercase tracking-wider">{config.label}</span>
      <h2 className="text-xl font-bold text-foreground mt-2 mb-1">{config.question}</h2>
      <p className="text-sm text-muted-foreground mb-5">{config.sub}</p>
      <div className="flex flex-col gap-2.5">
        {config.options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onToggle(opt.id)}
            className={`text-left p-4 rounded-xl border-[1.5px] transition-colors ${selected.has(opt.id) ? "border-primary bg-accent" : "border-border bg-card"}`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-md border-[1.5px] flex items-center justify-center shrink-0 ${selected.has(opt.id) ? "bg-primary border-primary" : "border-border"}`}>
                {selected.has(opt.id) && <Check className="w-3 h-3 text-primary-foreground" />}
              </div>
              <div>
                <span className="text-sm font-semibold text-foreground">{opt.label}</span>
                <p className="text-xs text-muted-foreground mt-0.5">{opt.detail}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
      <input
        value={customText}
        onChange={(e) => setCustomText(e.target.value)}
        placeholder={config.placeholder}
        className="w-full mt-4 px-4 py-3 rounded-xl border border-border bg-muted text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </div>
  );
}

interface Personalization {
  headline: string;
  subhead: string;
  painPoints: { title: string; detail: string }[];
  benefits: { title: string; detail: string }[];
}

interface PersistedState {
  step: number;
  selected0: string[];
  selected1: string[];
  selected2: string[];
  custom0: string;
  custom1: string;
  custom2: string;
}

function loadState(): Partial<PersistedState> {
  if (isTestingMode()) return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export default function OnboardingScreen() {
  const navigate = useNavigate();
  const { completeOnboarding, user } = useApp();
  const { send: sendFlow } = useFlow();

  const initial = useMemo(() => loadState(), []);
  const sessionDoneFlag = !isTestingMode() && typeof window !== "undefined" && localStorage.getItem("onboarding_done_session") === "1";
  const clampStep = (n: unknown): number => {
    const v = typeof n === "number" && Number.isFinite(n) ? Math.floor(n) : 0;
    return Math.max(0, Math.min(v, TOTAL_STEPS - 1));
  };
  const [step, setStep] = useState<number>(sessionDoneFlag ? TOTAL_STEPS - 1 : clampStep(initial.step ?? 0));
  const completedRef = useRef<boolean>(sessionDoneFlag);
  const [selected0, setSelected0] = useState<Set<string>>(new Set(initial.selected0 ?? []));
  const [selected1, setSelected1] = useState<Set<string>>(new Set(initial.selected1 ?? []));
  const [selected2, setSelected2] = useState<Set<string>>(new Set(initial.selected2 ?? []));
  const [custom0, setCustom0] = useState(initial.custom0 ?? "");
  const [custom1, setCustom1] = useState(initial.custom1 ?? "");
  const [custom2, setCustom2] = useState(initial.custom2 ?? "");
  const [personalization, setPersonalization] = useState<Personalization | null>(null);
  const [personalizing, setPersonalizing] = useState(false);
  const [personalizationError, setPersonalizationError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  const progress = ((step + 1) / TOTAL_STEPS) * 100;
  const firstName = user?.user_metadata?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "";

  // Persist progress so reloads don't lose context
  useEffect(() => {
    if (isTestingMode()) return;
    const data: PersistedState = {
      step,
      selected0: Array.from(selected0),
      selected1: Array.from(selected1),
      selected2: Array.from(selected2),
      custom0, custom1, custom2,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [step, selected0, selected1, selected2, custom0, custom1, custom2]);

  function canAdvance() {
    if (step === 0) return selected0.size > 0 || custom0.trim().length > 0;
    if (step === 1) return selected1.size > 0 || custom1.trim().length > 0;
    if (step === 2) return selected2.size > 0 || custom2.trim().length > 0;
    if (step === 3) return !personalizing; // gate while loading
    return step < TOTAL_STEPS - 1;
  }

  function next() { setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1)); }
  function back() { if (step > 0) setStep((s) => s - 1); }

  // Final CTA on the trial step → mark guest as onboarded and advance the flow.
  async function handleFinish() {
    if (finishing) return;
    setFinishing(true);
    try {
      markGuestOnboarded();
      await completeOnboarding();
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      if (!isTestingMode()) {
        try { localStorage.setItem("onboarding_done_session", "1"); } catch {}
      }
      completedRef.current = true;
      sendFlow("ONBOARDING_DONE");
    } finally {
      setFinishing(false);
    }
  }

  function makeToggle(setter: React.Dispatch<React.SetStateAction<Set<string>>>) {
    return (id: string) => {
      setter((prev) => {
        const n = new Set(prev);
        if (n.has(id)) n.delete(id); else n.add(id);
        return n;
      });
    };
  }

  // Generate AI personalization when entering step 3
  useEffect(() => {
    if (step !== 3 || personalization || personalizing) return;
    let cancelled = false;
    (async () => {
      setPersonalizing(true);
      setPersonalizationError(null);
      const feelings = Array.from(selected0).map((id) => Q0.options.find((o) => o.id === id)?.label || id);
      const worries = Array.from(selected1).map((id) => Q1.options.find((o) => o.id === id)?.label || id);
      const goals = Array.from(selected2).map((id) => Q2.options.find((o) => o.id === id)?.label || id);
      try {
        const { data, error } = await supabase.functions.invoke("generate-personalization", {
          body: {
            feelings, worries, goals,
            custom: { feelings: custom0, worries: custom1, goals: custom2 },
            firstName,
          },
        });
        if (cancelled) return;
        if (error || data?.error) {
          setPersonalizationError(data?.error || error?.message || "Couldn't personalize right now.");
        } else {
          setPersonalization(data);
        }
      } catch {
        if (!cancelled) setPersonalizationError("Couldn't personalize right now.");
      } finally {
        if (!cancelled) setPersonalizing(false);
      }
    })();
    return () => { cancelled = true; };
  }, [step]);

  function renderCta() {
    if (step < 3) {
      return (
        <button
          onClick={next}
          disabled={!canAdvance()}
          className="mt-5 w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 ease-out active:scale-[0.97]"
        >
          That's me <ArrowRight className="w-4 h-4" />
        </button>
      );
    }
    if (step === 3) {
      const disabled = personalizing;
      return (
        <button
          onClick={next}
          disabled={disabled}
          className="mt-5 w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 ease-out active:scale-[0.97]"
        >
          {disabled ? (<><Loader2 className="w-4 h-4 animate-spin" /> Personalizing…</>) : (<>Show me how <ArrowRight className="w-4 h-4" /></>)}
        </button>
      );
    }
    if (step === 4) {
      return (
        <button onClick={next} className="mt-5 w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 ease-out active:scale-[0.97]">
          Continue
        </button>
      );
    }
    if (step === 5) {
      return (
        <button
          onClick={handleFinish}
          disabled={finishing}
          className="mt-5 w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold text-sm disabled:opacity-60 transition-all duration-200 ease-out active:scale-[0.97]"
        >
          {finishing ? <><Loader2 className="w-4 h-4 animate-spin" /> Starting…</> : <>Try it free <ArrowRight className="w-4 h-4" /></>}
        </button>
      );
    }
    return null;
  }

  const billingDate = useMemo(() => {
    const d = new Date(Date.now() + 30 * 86400_000);
    return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  }, []);

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header with progress */}
      <div className="flex items-center gap-3 px-5 pt-[env(safe-area-inset-top,16px)] pb-3 shrink-0">
        <button
          onClick={back}
          className={`w-9 h-9 rounded-lg border border-border flex items-center justify-center ${step > 0 && step !== 6 && step !== 7 ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        >
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <button
          onClick={() => canAdvance() && next()}
          disabled={!canAdvance() || (step === 3 && personalizing)}
          className={`w-9 h-9 rounded-lg border border-border flex items-center justify-center ${canAdvance() && step !== 6 && step !== 7 ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        >
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pb-[max(env(safe-area-inset-bottom,16px),24px)]">
        <div className="bg-card border border-border rounded-2xl p-5 mt-2">
          {step === 0 && <MultiSelectStep config={Q0} selected={selected0} onToggle={makeToggle(setSelected0)} customText={custom0} setCustomText={setCustom0} />}
          {step === 1 && <MultiSelectStep config={Q1} selected={selected1} onToggle={makeToggle(setSelected1)} customText={custom1} setCustomText={setCustom1} />}
          {step === 2 && <MultiSelectStep config={Q2} selected={selected2} onToggle={makeToggle(setSelected2)} customText={custom2} setCustomText={setCustom2} />}

          {step === 3 && (
            <div>
              <div className="inline-flex items-center gap-1.5 bg-accent px-3 py-1.5 rounded-full mb-4">
                <Sparkles className="w-3 h-3 text-primary" />
                <span className="text-xs font-semibold text-accent-foreground uppercase tracking-wider">Made for you</span>
              </div>

              {personalizing && (
                <div className="flex flex-col gap-3 py-2">
                  <div className="h-7 w-3/4 rounded-md bg-muted animate-pulse" />
                  <div className="h-4 w-full rounded bg-muted animate-pulse" />
                  <div className="h-4 w-5/6 rounded bg-muted animate-pulse" />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Personalizing for you…
                  </div>
                </div>
              )}

              {personalizationError && !personalizing && (
                <div className="flex items-start gap-2 p-3 rounded-xl border border-border bg-muted">
                  <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground">{personalizationError} You can continue — we'll still tailor your follow-ups.</p>
                </div>
              )}

              {personalization && !personalizing && (
                <>
                  <h2 className="text-2xl font-bold text-foreground leading-[1.15] tracking-tight mb-2">
                    {personalization.headline}
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                    {personalization.subhead}
                  </p>

                  <div className="border border-border rounded-xl divide-y divide-border mb-4">
                    <div className="px-4 py-2.5 bg-muted/50">
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">What's weighing on you</span>
                    </div>
                    {personalization.painPoints.map((p, i) => (
                      <div key={i} className="p-3.5">
                        <p className="text-sm font-semibold text-foreground">{p.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{p.detail}</p>
                      </div>
                    ))}
                  </div>

                  <div className="border border-primary/30 bg-accent/40 rounded-xl divide-y divide-border">
                    <div className="px-4 py-2.5">
                      <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">How ChaseHQ helps</span>
                    </div>
                    {personalization.benefits.map((b, i) => (
                      <div key={i} className="p-3.5 flex gap-3">
                        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-3 h-3 text-primary-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{b.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{b.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {step === 4 && (
            <div>
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">How it removes the mental load</span>
              <h2 className="text-xl font-bold text-foreground mt-2 mb-5">Three things you'll never have to do alone again</h2>
              <div className="flex flex-col gap-4">
                {[
                  { icon: Mail, title: "Write the message", desc: "We draft every follow-up in your tone — Polite, Friendly, Firm or Urgent — so you never stare at a blank screen." },
                  { icon: Clock, title: "Decide when to send", desc: "Set the schedule once in Settings. ChaseHQ tracks each invoice and queues the next reminder for you." },
                  { icon: Zap, title: "Stay in control", desc: "Drafts wait in the invoice. Tweak the tone, then send via your connected Gmail — you stay in control." },
                ].map((f) => (
                  <div key={f.title} className="flex gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shrink-0">
                      <f.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{f.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 5 && (
            <div>
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">Try it free</span>
              <h2 className="text-xl font-bold text-foreground mt-2 mb-2">30 days free, then $5/month</h2>
              <p className="text-sm text-muted-foreground mb-5">
                Start with full access. We'll remind you before billing begins on <span className="font-semibold text-foreground">{billingDate}</span>. Cancel anytime in Settings.
              </p>

              <div className="border border-primary/30 bg-accent/40 rounded-xl p-4 mb-4">
                <div className="flex items-baseline gap-1.5 mb-3">
                  <span className="text-3xl font-bold text-foreground">$5</span>
                  <span className="text-sm text-muted-foreground">/ month after trial</span>
                </div>
                <ul className="flex flex-col gap-2.5">
                  {[
                    "AI-drafted follow-ups in 4 tones",
                    "Smart timing — we tell you when to send",
                    "Send via your connected Gmail",
                    "Final-notice escalation when needed",
                    "Cancel anytime, no questions asked",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-foreground">
                      <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-2.5 h-2.5 text-primary-foreground" />
                      </div>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex items-start gap-2 p-3 rounded-xl bg-muted">
                <Shield className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  No charge today. We'll email you 3 days before your trial ends. Manage or cancel from Settings → Billing.
                </p>
              </div>
            </div>
          )}

          {step === 6 && (
            <div>
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">Last step</span>
              <h2 className="text-xl font-bold text-foreground mt-2 mb-2">
                {isSignup ? "Create your account" : "Welcome back"}
              </h2>
              <p className="text-sm text-muted-foreground mb-5">
                {isSignup ? "Save your setup and start your free trial." : "Sign in to access your dashboard."}
              </p>

              {finishingTrial ? (
                <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Setting up your trial…
                </div>
              ) : (
                <>
                  <button
                    onClick={handleGoogle}
                    disabled={googleLoading || submitLoading}
                    className="w-full flex items-center justify-center gap-3 bg-card border border-border rounded-xl py-3 mb-4 disabled:opacity-60"
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

                  <form onSubmit={handleAuthSubmit} className="flex flex-col gap-3">
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
                      disabled={submitLoading || googleLoading || (isSignup && !canSubmitAuth)}
                      className="mt-2 flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold text-sm disabled:opacity-50"
                    >
                      {submitLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isSignup ? "Start my free trial" : "Sign in")}
                    </button>
                  </form>

                  <p className="text-center text-xs text-muted-foreground mt-4">
                    {isSignup ? "Already have an account?" : "New to ChaseHQ?"}{" "}
                    <button
                      onClick={() => { setAuthMode(isSignup ? "signin" : "signup"); setPasswordTouched(false); }}
                      className="font-semibold text-primary"
                    >
                      {isSignup ? "Sign in" : "Create one"}
                    </button>
                  </p>
                </>
              )}
            </div>
          )}

          {/* Post-auth "You're in" decision is rendered at /pre-dashboard via FlowMachine. */}

          {/* CTA sits directly below the user's responses */}
          {renderCta()}
        </div>
      </div>
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
