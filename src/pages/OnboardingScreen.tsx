import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { isTestingMode } from "@/lib/testingMode";
import { markGuestOnboarded } from "@/lib/localInvoice";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import { analytics } from "@/lib/analytics";
import { useFlow } from "@/flow/FlowMachine";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";

const STORAGE_KEY = "onboarding_v5";
const TOTAL_STEPS = 6;

type MirrorType = "overdue" | "overthinking" | "avoidance" | "inconsistent";
type ToneType = "polite" | "friendly" | "firm";
type InstinctType = "wait" | "nudge" | "persist";

interface OnboardingState {
  mirror_types: MirrorType[];
  tone_preference: ToneType | null;
  chase_instinct: InstinctType | null;
  current_step: number;
}

const MIRROR_OPTIONS: { id: MirrorType; label: string }[] = [
  { id: "overdue",      label: "Dreading the follow-up before I've even written it" },
  { id: "overthinking", label: "Overthinking every word so I don't seem pushy" },
  { id: "avoidance",    label: "Putting it off until it feels too late to ask" },
  { id: "inconsistent", label: "Letting invoices slide because I hate the whole thing" },
];

const TONE_OPTIONS: { id: ToneType; label: string; desc: string }[] = [
  { id: "polite",   label: "Polite",   desc: "Courteous and measured — respectful even when payment is overdue" },
  { id: "friendly", label: "Friendly", desc: "Warm and personable — keeps the relationship intact" },
  { id: "firm",     label: "Firm",     desc: "Direct and assertive — clear that payment is needed now" },
];

const INSTINCT_OPTIONS: { id: InstinctType; label: string; desc: string }[] = [
  { id: "wait",    label: "Give it time",      desc: "Let reminders do the work — one follow-up, then patience" },
  { id: "nudge",   label: "One gentle nudge",  desc: "A timely follow-up or two, then step back" },
  { id: "persist", label: "Keep following up", desc: "Stay on it — systematic until you're paid" },
];

const DEFAULT_STATE: OnboardingState = {
  mirror_types: [],
  tone_preference: null,
  chase_instinct: null,
  current_step: 1,
};

function toggle<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];
}

const VALID_TONES = new Set<ToneType>(["polite", "friendly", "firm"]);

function loadState(): OnboardingState {
  if (isTestingMode()) return { ...DEFAULT_STATE };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw);
    const step = typeof parsed.current_step === "number" ? Math.max(1, Math.min(parsed.current_step, TOTAL_STEPS)) : 1;
    const savedTone = parsed.tone_preference;
    const savedInstinct = parsed.chase_instinct;
    return {
      mirror_types: Array.isArray(parsed.mirror_types) ? parsed.mirror_types : [],
      tone_preference: typeof savedTone === "string" && VALID_TONES.has(savedTone as ToneType) ? (savedTone as ToneType) : null,
      chase_instinct: typeof savedInstinct === "string" && (["wait", "nudge", "persist"] as string[]).includes(savedInstinct) ? (savedInstinct as InstinctType) : null,
      current_step: step,
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export default function OnboardingScreen() {
  const { isAuthenticated, hasCompletedOnboarding, profileReady, notifications, updateNotifications } = useApp();
  const { send: sendFlow } = useFlow();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isTestingMode() && isAuthenticated && profileReady && hasCompletedOnboarding) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, profileReady, hasCompletedOnboarding, navigate]);

  const initial = useMemo(() => loadState(), []);

  const [currentStep, setCurrentStep] = useState<number>(initial.current_step);
  const [mirrorTypes, setMirrorTypes] = useState<MirrorType[]>(initial.mirror_types);
  const [tonePreference, setTonePreference] = useState<ToneType | null>(initial.tone_preference);
  const [chaseInstinct, setChaseInstinct] = useState<InstinctType | null>(initial.chase_instinct);

  const progress = (currentStep / TOTAL_STEPS) * 100;

  useEffect(() => {
    if (isTestingMode()) return;
    const data: OnboardingState = {
      mirror_types: mirrorTypes,
      tone_preference: tonePreference,
      chase_instinct: chaseInstinct,
      current_step: currentStep,
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
  }, [currentStep, mirrorTypes, tonePreference, chaseInstinct]);

  function canGoBack() { return currentStep > 1 && currentStep <= TOTAL_STEPS; }

  function canAdvance(): boolean {
    if (currentStep === 1) return mirrorTypes.length > 0;
    if (currentStep === 2) return true;
    if (currentStep === 3) return true;
    if (currentStep === 4) return true;
    if (currentStep === 5) return tonePreference !== null && chaseInstinct !== null;
    return false; // Step 6 has its own CTA
  }

  function goNext() { if (currentStep < TOTAL_STEPS) setCurrentStep((s) => s + 1); }
  function goBack() { if (canGoBack()) setCurrentStep((s) => s - 1); }

  function applyOnboardingDefaults() {
    const toneMap: Record<ToneType, "Polite" | "Friendly" | "Firm"> = { polite: "Polite", friendly: "Friendly", firm: "Firm" };
    const tone = tonePreference ? toneMap[tonePreference] : "Friendly";
    updateNotifications({ ...notifications, defaultTone: tone });

    const presetMap: Record<InstinctType, "patient" | "light" | "active"> = { wait: "patient", nudge: "light", persist: "active" };
    const preset = chaseInstinct ? presetMap[chaseInstinct] : "patient";
    try { localStorage.setItem(STORAGE_KEYS.SCHEDULE_PRESET, preset); } catch {}
  }

  function handleFinishOnboarding() {
    markGuestOnboarded();
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
                That's me <ArrowRight className="w-4 h-4" />
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
                Show me how <ArrowRight className="w-4 h-4" />
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
                Sounds like a relief <ArrowRight className="w-4 h-4" />
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
                Okay, I'm in <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Step 5 — Personalization */}
          {currentStep === 5 && (
            <div className="bg-card border border-border rounded-2xl p-5 mt-2">
              <h2 className="text-xl font-bold text-foreground mt-2 mb-1">Two quick things so ChaseHQ works like you do.</h2>
              <p className="text-sm text-muted-foreground mb-6">Pick what feels closest — you can adjust anytime.</p>

              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Communication Style</p>
              <div className="flex flex-col gap-2 mb-6">
                {TONE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setTonePreference(opt.id)}
                    className={`text-left px-4 py-3.5 rounded-xl border-[1.5px] transition-colors ${tonePreference === opt.id ? "border-primary bg-accent" : "border-border bg-card"}`}
                  >
                    <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>

              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Follow-up Style</p>
              <div className="flex flex-col gap-2">
                {INSTINCT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setChaseInstinct(opt.id)}
                    className={`text-left px-4 py-3.5 rounded-xl border-[1.5px] transition-colors ${chaseInstinct === opt.id ? "border-primary bg-accent" : "border-border bg-card"}`}
                  >
                    <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>

              <button
                onClick={goNext}
                disabled={tonePreference === null || chaseInstinct === null}
                aria-disabled={tonePreference === null || chaseInstinct === null}
                className={`mt-5 w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 ease-out active:scale-[0.97] ${tonePreference === null || chaseInstinct === null ? "opacity-40 pointer-events-none" : ""}`}
              >
                Set my defaults <ArrowRight className="w-4 h-4" />
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
                Let's go get paid <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
