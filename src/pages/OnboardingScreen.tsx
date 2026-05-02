import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { isTestingMode } from "@/lib/testingMode";
import { markGuestOnboarded } from "@/lib/localInvoice";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import { analytics } from "@/lib/analytics";
import { useFlow } from "@/flow/FlowMachine";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";

const STORAGE_KEY = "onboarding_v6";
const TOTAL_STEPS = 6;

type MirrorType = "overdue" | "overthinking" | "avoidance" | "inconsistent";
type StyleType = "warm" | "steady" | "firm";

interface OnboardingState {
  mirror_types: MirrorType[];
  follow_up_style: StyleType | null;
  current_step: number;
}

const MIRROR_OPTIONS: { id: MirrorType; label: string }[] = [
  { id: "overdue",      label: "Dreading the follow-up before I've even written it" },
  { id: "overthinking", label: "Overthinking every word so I don't seem pushy" },
  { id: "avoidance",    label: "Putting it off until it feels too late to ask" },
  { id: "inconsistent", label: "Letting invoices slide because I hate the whole thing" },
];

const STYLE_OPTIONS: { id: StyleType; label: string; desc: string }[] = [
  { id: "warm",   label: "Warm & patient",        desc: "Gentle reminders with plenty of breathing room — low pressure, high trust" },
  { id: "steady", label: "Steady & professional",  desc: "Warm but consistent — regular follow-ups that mean business" },
  { id: "firm",   label: "Direct & persistent",    desc: "Clear, systematic follow-ups until you're paid" },
];

const DEFAULT_STATE: OnboardingState = {
  mirror_types: [],
  follow_up_style: null,
  current_step: 1,
};

function toggle<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];
}

const VALID_STYLES = new Set<StyleType>(["warm", "steady", "firm"]);

function loadState(): OnboardingState {
  if (isTestingMode()) return { ...DEFAULT_STATE };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw);
    const step = typeof parsed.current_step === "number" ? Math.max(1, Math.min(parsed.current_step, TOTAL_STEPS)) : 1;
    const savedStyle = parsed.follow_up_style;
    return {
      mirror_types: Array.isArray(parsed.mirror_types) ? parsed.mirror_types : [],
      follow_up_style: typeof savedStyle === "string" && VALID_STYLES.has(savedStyle as StyleType) ? (savedStyle as StyleType) : null,
      current_step: step,
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export default function OnboardingScreen() {
  const { isAuthenticated, hasCompletedOnboarding, profileReady, onboardingStep, notifications, updateNotifications, completeOnboarding, updateOnboardingStep } = useApp();
  const { send: sendFlow } = useFlow();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isTestingMode() && isAuthenticated && profileReady && hasCompletedOnboarding) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, profileReady, hasCompletedOnboarding, navigate]);

  const initial = useMemo(() => loadState(), []);

  // Authenticated users resume from the DB-persisted step; guests fall back to localStorage.
  const initialStep = isAuthenticated && profileReady && onboardingStep > 0
    ? Math.max(1, Math.min(onboardingStep, TOTAL_STEPS))
    : initial.current_step;
  const [currentStep, setCurrentStep] = useState<number>(initialStep);
  const [mirrorTypes, setMirrorTypes] = useState<MirrorType[]>(initial.mirror_types);
  const [followUpStyle, setFollowUpStyle] = useState<StyleType | null>(initial.follow_up_style);

  const progress = (currentStep / TOTAL_STEPS) * 100;

  useEffect(() => {
    if (isTestingMode()) return;
    const data: OnboardingState = {
      mirror_types: mirrorTypes,
      follow_up_style: followUpStyle,
      current_step: currentStep,
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
  }, [currentStep, mirrorTypes, followUpStyle]);

  // Persist current step to DB for authenticated users so they resume from where they left off.
  useEffect(() => {
    if (isTestingMode()) return;
    if (!isAuthenticated) return;
    if (currentStep === onboardingStep) return;
    const t = window.setTimeout(() => {
      updateOnboardingStep(currentStep);
    }, 300);
    return () => window.clearTimeout(t);
  }, [currentStep, isAuthenticated, onboardingStep, updateOnboardingStep]);

  function canGoBack() { return currentStep > 1 && currentStep <= TOTAL_STEPS; }

  function canAdvance(): boolean {
    if (currentStep === 1) return mirrorTypes.length > 0;
    if (currentStep === 2) return true;
    if (currentStep === 3) return true;
    if (currentStep === 4) return true;
    if (currentStep === 5) return followUpStyle !== null;
    return false; // Step 6 has its own CTA
  }

  function goNext() { if (currentStep < TOTAL_STEPS) setCurrentStep((s) => s + 1); }
  function goBack() { if (canGoBack()) setCurrentStep((s) => s - 1); }

  function applyOnboardingDefaults() {
    const styleMap: Record<StyleType, { tone: "Friendly" | "Firm"; preset: "patient" | "light" | "active" }> = {
      warm:   { tone: "Friendly", preset: "patient" },
      steady: { tone: "Friendly", preset: "light"   },
      firm:   { tone: "Firm",     preset: "active"  },
    };
    const { tone, preset } = followUpStyle ? styleMap[followUpStyle] : styleMap.steady;
    updateNotifications({ ...notifications, defaultTone: tone });
    try { localStorage.setItem(STORAGE_KEYS.SCHEDULE_PRESET, preset); } catch {}
  }

  async function handleFinishOnboarding() {
    if (isAuthenticated) {
      await completeOnboarding();
    } else {
      markGuestOnboarded();
    }
    applyOnboardingDefaults();
    analytics.onboardingCompleted([], [], []);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    sendFlow("DECIDE_SKIP");
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header: back chevron · progress bar · forward chevron */}
      <div className="flex items-center gap-3 px-5 pt-[env(safe-area-inset-top,16px)] pb-3 shrink-0">
        <button
          onClick={goBack}
          className={`w-9 h-9 rounded-lg border border-border flex items-center justify-center transition-transform duration-150 ease-out active:scale-[0.92] ${canGoBack() ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          aria-label="Back"
        >
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <button
          onClick={() => canAdvance() && goNext()}
          className={`w-9 h-9 rounded-lg border border-border flex items-center justify-center transition-transform duration-150 ease-out active:scale-[0.92] ${canAdvance() && currentStep < TOTAL_STEPS ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          aria-label="Next"
        >
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pb-[max(env(safe-area-inset-bottom,16px),24px)]">
        <div key={currentStep} className="animate-slide-in-left">

          {/* Step 1 — The Mirror */}
          {currentStep === 1 && (
            <div className="bg-card border border-border rounded-2xl p-5 mt-2">
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">Real quick</span>
              <h2 className="text-xl font-bold text-foreground mt-2 mb-1">Which of these sounds like you?</h2>
              <p className="text-sm text-muted-foreground mb-5">Pick everything that fits.</p>
              <div className="flex flex-col gap-2.5">
                {MIRROR_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setMirrorTypes(prev => toggle(prev, opt.id))}
                    className={`text-left px-4 py-3.5 rounded-xl border-[1.5px] transition-colors ${mirrorTypes.includes(opt.id) ? "border-primary bg-accent" : "border-border bg-card"}`}
                  >
                    <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                  </button>
                ))}
              </div>
              <button
                onClick={goNext}
                disabled={mirrorTypes.length === 0}
                aria-disabled={mirrorTypes.length === 0}
                className={`mt-5 w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 ease-out active:scale-[0.97] ${mirrorTypes.length === 0 ? "opacity-40 pointer-events-none" : ""}`}
              >
                That's Me <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Step 2 — The Number */}
          {currentStep === 2 && (
            <div className="bg-card border border-border rounded-2xl p-5 mt-2">
              <div className="mt-2 mb-2">
                <p className="text-6xl font-bold text-foreground leading-none">85%</p>
                <p className="text-sm text-muted-foreground mt-2">of freelancers have invoices paid late</p>
              </div>
              <div className="mt-8 mb-2">
                <p className="text-6xl font-bold text-foreground leading-none">29 days</p>
                <p className="text-sm text-muted-foreground mt-2">the average wait after the due date</p>
              </div>
              <p className="mt-8 text-sm text-foreground leading-relaxed">
                It's not gone — it's just sitting there, waiting for someone to ask. But 29 days is a long time to float someone else's invoice.
              </p>
              <p className="mt-3 text-sm font-semibold text-foreground">
                That's a month of rent. A new laptop. A week off.
              </p>
              <button
                onClick={goNext}
                className="mt-6 w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 ease-out active:scale-[0.97]"
              >
                Show Me How <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Step 3 — Peace of Mind */}
          {currentStep === 3 && (
            <div className="bg-card border border-border rounded-2xl p-5 mt-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">No more wondering</span>
              <h2 className="text-xl font-bold text-foreground mt-2 mb-5">Stop running the follow-up in your head.</h2>
              <div className="flex flex-col gap-3 mb-5">
                {[
                  '"Did they even see my email?"',
                  '"Is it too soon to ask again?"',
                  '"Will this one come across as pushy?"',
                ].map((q) => (
                  <div key={q} className="bg-muted/50 border border-border rounded-xl px-4 py-3.5">
                    <p className="text-sm text-muted-foreground italic">{q}</p>
                  </div>
                ))}
              </div>
              <div className="border-l-2 border-primary bg-accent rounded-r-xl px-4 py-3.5 mb-6">
                <p className="text-sm text-foreground">ChaseHQ handles the thinking. <span className="font-bold">You get your head back.</span></p>
              </div>
              <button
                onClick={goNext}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 ease-out active:scale-[0.97]"
              >
                Sounds Like a Relief <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Step 4 — How It Works */}
          {currentStep === 4 && (
            <div className="bg-card border border-border rounded-2xl p-5 mt-2">
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">Why ChaseHQ exists</span>
              <h2 className="text-xl font-bold text-foreground mt-2 mb-1">Reminders were never the hard part.</h2>
              <p className="text-sm text-muted-foreground mb-5">Writing the message is.</p>
              <div className="grid grid-cols-3 gap-2 mb-5">
                {[
                  { label: "Words",  title: "What to say",      desc: "Written in the tone you set." },
                  { label: "Moment", title: "When to send",     desc: "Sent on the schedule you choose." },
                  { label: "Tone",   title: "How to phrase it", desc: "Warm or firm — never awkward." },
                ].map((f) => (
                  <div key={f.title} className="bg-background border border-border rounded-xl p-3">
                    <p className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-2">{f.label}</p>
                    <p className="text-sm font-semibold text-foreground leading-tight mb-1">{f.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground italic mb-5">The whole conversation, off your plate.</p>
              <button
                onClick={goNext}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 ease-out active:scale-[0.97]"
              >
                Okay, I'm In <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Step 5 — Personalization */}
          {currentStep === 5 && (
            <div className="bg-card border border-border rounded-2xl p-5 mt-2">
              <h2 className="text-xl font-bold text-foreground mt-2 mb-1">One quick thing so ChaseHQ works like you do.</h2>
              <p className="text-sm text-muted-foreground mb-6">Pick what feels closest — you can adjust anytime.</p>

              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Your Follow-Up Style</p>
              <div className="flex flex-col gap-2">
                {STYLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setFollowUpStyle(opt.id)}
                    style={{ touchAction: "manipulation" }}
                    className={`text-left px-4 py-3.5 rounded-xl border-[1.5px] transition-colors ${followUpStyle === opt.id ? "border-primary bg-accent" : "border-border bg-card"}`}
                  >
                    <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>

              <p className="text-xs text-muted-foreground mt-4 text-center">
                These shape how ChaseHQ writes and times your follow-ups — for every invoice.
              </p>
              <button
                onClick={() => { if (followUpStyle) goNext(); }}
                aria-disabled={!followUpStyle}
                style={{ touchAction: "manipulation" }}
                className={`mt-3 w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 ease-out active:scale-[0.97] ${followUpStyle ? "" : "opacity-40 pointer-events-none"}`}
              >
                Set My Style <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Step 6 — You're In */}
          {currentStep === 6 && (
            <div className="mt-2 flex flex-col items-center text-center pt-10">
              <span className="text-xs font-semibold tracking-widest text-primary uppercase">✦ You're In</span>
              <h2 className="text-2xl font-bold text-foreground mt-3 mb-3">The hard part is over.</h2>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                ChaseHQ knows how you work. Now let's put it to work for you.
              </p>
              <button
                onClick={handleFinishOnboarding}
                className="mt-10 w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 ease-out active:scale-[0.97]"
              >
                Let's Go Get Paid <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
