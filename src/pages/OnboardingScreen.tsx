import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { isTestingMode } from "@/lib/testingMode";
import { markGuestOnboarded } from "@/lib/localInvoice";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import { analytics } from "@/integrations/analytics";
import { useFlow } from "@/flow/FlowMachine";
import { ChevronLeft, ChevronRight, ArrowRight, Check, Sparkles } from "lucide-react";
import type {
  WorkType,
  InvoiceSizeBucket,
  ClientLoadBucket,
  MirrorBlocker,
  WorstOverdueBucket,
  UserProfile,
} from "@/lib/userProfile/types";
import {
  writeWorkType,
  writeInvoiceSize,
  writeClientLoad,
  writeMirrorBlockers,
  writeWorstOverdueBucket,
  writeChaseSchedule,
  writeRecommendedSchedule,
  writeDidOverrideSchedule,
} from "@/lib/userProfile/storage";
import { toTitleCase } from "@/lib/textCase";
import { recommendSchedule, recommendationReasonLine } from "@/lib/recommendSchedule";
import type { SchedulePreset } from "@/lib/scheduleDefaults";

const STORAGE_KEY = "onboarding_v7";
const TOTAL_STEPS = 12;

type StyleType = "warm" | "steady" | "firm";

interface OnboardingState {
  mirror_types: MirrorBlocker[];
  worst_overdue: WorstOverdueBucket | null;
  work_type: WorkType | null;
  invoice_size: InvoiceSizeBucket | null;
  client_load: ClientLoadBucket | null;
  follow_up_style: StyleType | null;
  chase_schedule: SchedulePreset | null;
  signature_name: string;
  current_step: number;
}

const MIRROR_OPTIONS: { id: MirrorBlocker; label: string }[] = [
  { id: "dread",         label: "Dreading the follow-up before I've even written it" },
  { id: "overthinking",  label: "Overthinking every word so I don't seem pushy" },
  { id: "avoidance",     label: "Putting it off until it feels too late to ask" },
  { id: "letting_slide", label: "Letting invoices slide because I hate the whole thing" },
];

const WORST_OVERDUE_OPTIONS: { id: WorstOverdueBucket; label: string; sub: string }[] = [
  { id: "<14",   label: "Under 2 weeks", sub: "Mostly on top of it" },
  { id: "14-30", label: "2 to 4 weeks",  sub: "Standard wait" },
  { id: "30-60", label: "1 to 2 months", sub: "Chronic late-payment territory" },
  { id: "60+",   label: "60+ days",      sub: "Too long" },
];

const WORK_TYPE_OPTIONS: { id: WorkType; label: string; desc: string }[] = [
  { id: "designer",   label: "Designer",          desc: "Visual, brand, product, or web" },
  { id: "developer",  label: "Developer",         desc: "Engineer, builder, or technical contractor" },
  { id: "writer",     label: "Writer",            desc: "Content, copy, editorial, or technical writing" },
  { id: "consultant", label: "Consultant",        desc: "Strategy, advisory, or coaching" },
  { id: "agency",     label: "Agency or studio",  desc: "A small team or studio you run" },
  { id: "other",      label: "Something else",    desc: "Freelance, but not the above" },
];

const INVOICE_SIZE_OPTIONS: { id: InvoiceSizeBucket; label: string; sub: string }[] = [
  { id: "<500",   label: "Under $500",     sub: "Quick gigs and small projects" },
  { id: "500-2k", label: "$500 to $2,000", sub: "Most freelance projects" },
  { id: "2k-10k", label: "$2,000 to $10,000", sub: "Mid-size engagements" },
  { id: "10k+",   label: "$10,000+",       sub: "Larger projects or retainers" },
];

const CLIENT_LOAD_OPTIONS: { id: ClientLoadBucket; label: string; sub: string }[] = [
  { id: "1-3",  label: "1 to 3 clients",  sub: "Each relationship matters" },
  { id: "4-10", label: "4 to 10 clients", sub: "A typical freelance load" },
  { id: "10+",  label: "More than 10",    sub: "Volume — automation territory" },
];

const STYLE_OPTIONS: { id: StyleType; label: string; desc: string }[] = [
  { id: "warm",   label: "Warm & patient",       desc: "Low pressure, generous timelines" },
  { id: "steady", label: "Steady & professional", desc: "Warm but consistent and on schedule" },
  { id: "firm",   label: "Direct & persistent",  desc: "Systematic follow-ups until you're paid" },
];

const SCHEDULE_OPTIONS: {
  id: SchedulePreset;
  label: string;
  cadence: string;
  desc: string;
}[] = [
  { id: "active",  label: "Active",   cadence: "4 reminders · 3 / 7 / 14 / 21 days", desc: "Tighter cadence — best when payments need to land fast" },
  { id: "patient", label: "Standard", cadence: "4 reminders · 5 / 13 / 20 / 23 days", desc: "Measured rhythm — the default for most freelancers" },
  { id: "light",   label: "Relaxed",  cadence: "4 reminders · 7 / 14 / 21 / 28 days", desc: "Gentler pace — great for long-standing clients" },
];

const DEFAULT_STATE: OnboardingState = {
  mirror_types: [],
  worst_overdue: null,
  work_type: null,
  invoice_size: null,
  client_load: null,
  follow_up_style: null,
  chase_schedule: null,
  signature_name: "",
  current_step: 1,
};

function toggle<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];
}

const VALID_STYLES = new Set<StyleType>(["warm", "steady", "firm"]);
const VALID_MIRRORS = new Set<MirrorBlocker>(["dread", "overthinking", "avoidance", "letting_slide"]);
const VALID_WORST = new Set<WorstOverdueBucket>(["<14", "14-30", "30-60", "60+"]);
const VALID_WORK = new Set<WorkType>(["designer", "developer", "writer", "consultant", "agency", "other"]);
const VALID_SIZE = new Set<InvoiceSizeBucket>(["<500", "500-2k", "2k-10k", "10k+"]);
const VALID_LOAD = new Set<ClientLoadBucket>(["1-3", "4-10", "10+"]);
const VALID_SCHEDULE = new Set<SchedulePreset>(["active", "patient", "light"]);

function loadState(): OnboardingState {
  if (isTestingMode()) return { ...DEFAULT_STATE };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw);
    const step = typeof parsed.current_step === "number" ? Math.max(1, Math.min(parsed.current_step, TOTAL_STEPS)) : 1;
    const mirrors = Array.isArray(parsed.mirror_types)
      ? parsed.mirror_types.filter((x: unknown): x is MirrorBlocker => typeof x === "string" && VALID_MIRRORS.has(x as MirrorBlocker))
      : [];
    const pickOne = <T,>(v: unknown, set: Set<T>) =>
      typeof v === "string" && set.has(v as T) ? (v as T) : null;
    return {
      mirror_types: mirrors,
      worst_overdue:    pickOne(parsed.worst_overdue,   VALID_WORST),
      work_type:        pickOne(parsed.work_type,       VALID_WORK),
      invoice_size:     pickOne(parsed.invoice_size,    VALID_SIZE),
      client_load:      pickOne(parsed.client_load,     VALID_LOAD),
      follow_up_style:  pickOne(parsed.follow_up_style, VALID_STYLES),
      chase_schedule:   pickOne(parsed.chase_schedule,  VALID_SCHEDULE),
      signature_name:   typeof parsed.signature_name === "string" ? parsed.signature_name : "",
      current_step: step,
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export default function OnboardingScreen() {
  const { isAuthenticated, hasCompletedOnboarding, profileReady, onboardingStep, notifications, fullName, updateNotifications, updateDisplayName, completeOnboarding, updateOnboardingStep, refreshUserProfile } = useApp();
  const { send: sendFlow } = useFlow();
  const navigate = useNavigate();

  // If the user interacted with EarlyMirrorSlide (shown inside OAuthOverlay during
  // sign-up), their selections were written to sessionStorage. Apply them once here
  // so slide 1 shows pre-selected options when the overlay drops.
  useEffect(() => {
    const raw = sessionStorage.getItem(STORAGE_KEYS.EARLY_MIRROR_SELECTIONS);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setMirrorTypes(parsed);
      }
    } catch {}
    sessionStorage.removeItem(STORAGE_KEYS.EARLY_MIRROR_SELECTIONS);
  }, []);

  useEffect(() => {
    if (!isTestingMode() && isAuthenticated && profileReady && hasCompletedOnboarding) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, profileReady, hasCompletedOnboarding, navigate]);

  const initial = useMemo(() => loadState(), []);

  const initialStep = isAuthenticated && profileReady && onboardingStep > 0
    ? Math.max(1, Math.min(onboardingStep, TOTAL_STEPS))
    : initial.current_step;
  const [currentStep, setCurrentStep] = useState<number>(initialStep);
  const [mirrorTypes, setMirrorTypes] = useState<MirrorBlocker[]>(initial.mirror_types);
  const [worstOverdue, setWorstOverdue] = useState<WorstOverdueBucket | null>(initial.worst_overdue);
  const [workType, setWorkType] = useState<WorkType | null>(initial.work_type);
  const [invoiceSize, setInvoiceSize] = useState<InvoiceSizeBucket | null>(initial.invoice_size);
  const [clientLoad, setClientLoad] = useState<ClientLoadBucket | null>(initial.client_load);
  const [followUpStyle, setFollowUpStyle] = useState<StyleType | null>(initial.follow_up_style);
  const [chaseSchedule, setChaseSchedule] = useState<SchedulePreset | null>(initial.chase_schedule);
  const [signatureName, setSignatureName] = useState<string>(toTitleCase(initial.signature_name || fullName || ""));

  const progress = (currentStep / TOTAL_STEPS) * 100;

  // Build a partial profile for the recommendation so it incorporates the
  // latest answers (incl. answers the user changed by going back).
  const partialProfile: UserProfile = useMemo(() => ({
    workType: workType ?? undefined,
    invoiceSize: invoiceSize ?? undefined,
    clientLoad: clientLoad ?? undefined,
    mirrorBlockers: mirrorTypes.length ? mirrorTypes : undefined,
    worstOverdueBucket: worstOverdue ?? undefined,
  }), [workType, invoiceSize, clientLoad, mirrorTypes, worstOverdue]);

  const recommendation = useMemo(() => recommendSchedule(partialProfile), [partialProfile]);
  const reasonLine = useMemo(() => recommendationReasonLine(recommendation, partialProfile), [recommendation, partialProfile]);

  // When the user lands on the Chase Schedule step, pre-select the recommended
  // option if they haven't picked one yet. Don't override an existing choice.
  useEffect(() => {
    if (currentStep === 8 && !chaseSchedule) {
      setChaseSchedule(recommendation.preset);
    }
  }, [currentStep, chaseSchedule, recommendation.preset]);

  useEffect(() => {
    if (isTestingMode()) return;
    const data: OnboardingState = {
      mirror_types: mirrorTypes,
      worst_overdue: worstOverdue,
      work_type: workType,
      invoice_size: invoiceSize,
      client_load: clientLoad,
      follow_up_style: followUpStyle,
      chase_schedule: chaseSchedule,
      signature_name: signatureName,
      current_step: currentStep,
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
  }, [currentStep, mirrorTypes, worstOverdue, workType, invoiceSize, clientLoad, followUpStyle, chaseSchedule, signatureName]);

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
    switch (currentStep) {
      case 1:  return mirrorTypes.length > 0;
      case 2:  return worstOverdue !== null;
      case 3:  return workType !== null;
      case 4:  return invoiceSize !== null;
      case 5:  return clientLoad !== null;
      case 6:  return true;                            // Value Promise — informational
      case 7:  return followUpStyle !== null;          // Tone
      case 8:  return chaseSchedule !== null;          // Chase Schedule
      case 9:  return signatureName.trim().length > 0; // Signature
      case 10: return true;                            // Calibrating (auto-advances)
      case 11: return true;                            // Plan Ready
      default: return false;                           // Step 12 (Hard Part Is Over) has its own CTA
    }
  }

  function goNext() { if (currentStep < TOTAL_STEPS) setCurrentStep((s) => s + 1); }
  function goBack() { if (canGoBack()) setCurrentStep((s) => s - 1); }

  function applyOnboardingDefaults() {
    // Tone from follow-up style
    const toneMap: Record<StyleType, "Friendly" | "Firm"> = {
      warm: "Friendly", steady: "Friendly", firm: "Firm",
    };
    const tone = followUpStyle ? toneMap[followUpStyle] : "Friendly";
    updateNotifications({ ...notifications, defaultTone: tone });

    // Schedule preset (chosen on slide 8, defaults to recommendation)
    const finalSchedule = chaseSchedule ?? recommendation.preset;
    writeChaseSchedule(finalSchedule);
    writeRecommendedSchedule(recommendation.preset);
    writeDidOverrideSchedule(chaseSchedule !== null && chaseSchedule !== recommendation.preset);

    // Profile fields
    if (workType) writeWorkType(workType);
    if (invoiceSize) writeInvoiceSize(invoiceSize);
    if (clientLoad) writeClientLoad(clientLoad);
    if (worstOverdue) writeWorstOverdueBucket(worstOverdue);
    if (mirrorTypes.length) writeMirrorBlockers(mirrorTypes);

    // Display name → AppContext + DB
    const trimmed = toTitleCase(signatureName.trim());
    if (trimmed && trimmed !== fullName) {
      void updateDisplayName(trimmed);
    }

    refreshUserProfile();
  }

  async function handleFinishOnboarding() {
    const isDemo = localStorage.getItem("chasehq_demo_mode") === "1";
    if (isAuthenticated || isDemo) {
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
            <div className="card-elevated p-5 mt-2">
              <span className="text-xs font-semibold text-primary uppercase tracking-[0.12em]">Real quick</span>
              <h2 className="text-[clamp(22px,5.5vw,28px)] font-bold text-foreground tracking-[-0.02em] leading-[1.15] mt-2 mb-1">Which of these sounds like you?</h2>
              <p className="text-[15px] text-muted-foreground mb-5">Pick everything that fits.</p>
              <div className="flex flex-col gap-2.5">
                {MIRROR_OPTIONS.map((opt) => {
                  const selected = mirrorTypes.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setMirrorTypes(prev => toggle(prev, opt.id))}
                      className={`relative text-left px-4 py-3.5 rounded-xl border-2 transition-all ${selected ? "border-primary bg-accent/40 shadow-[var(--shadow-card)]" : "border-border bg-card hover:border-primary/30 hover:shadow-[var(--shadow-card)]"}`}
                    >
                      <p className="text-sm font-semibold text-foreground pr-6">{opt.label}</p>
                      {selected && (
                        <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[11px] font-bold">✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={goNext}
                disabled={mirrorTypes.length === 0}
                aria-disabled={mirrorTypes.length === 0}
                className={`mt-5 w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 ease-out active:scale-[0.97] shadow-[0_8px_24px_rgba(91,123,142,0.25)] ${mirrorTypes.length === 0 ? "opacity-40 pointer-events-none shadow-none" : ""}`}
              >
                That's Me <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Step 2 — Worst Overdue (replaces stats slide) */}
          {currentStep === 2 && (
            <div className="card-elevated p-5 mt-2">
              <span className="text-xs font-semibold text-primary uppercase tracking-[0.12em]">Be honest</span>
              <h2 className="text-[clamp(22px,5.5vw,28px)] font-bold text-foreground tracking-[-0.02em] leading-[1.15] mt-2 mb-1">What's the longest you've waited on a payment?</h2>
              <p className="text-[15px] text-muted-foreground mb-5">No judgment — this just helps us calibrate the right cadence.</p>
              <div className="flex flex-col gap-2.5">
                {WORST_OVERDUE_OPTIONS.map((opt) => {
                  const selected = worstOverdue === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setWorstOverdue(opt.id)}
                      className={`relative text-left px-4 py-3.5 rounded-xl border-2 transition-all ${selected ? "border-primary bg-accent/40 shadow-[var(--shadow-card)]" : "border-border bg-card hover:border-primary/30 hover:shadow-[var(--shadow-card)]"}`}
                    >
                      <p className="text-sm font-semibold text-foreground pr-6">{opt.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 pr-6">{opt.sub}</p>
                      {selected && (
                        <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[11px] font-bold">✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
              {worstOverdue && (
                <p className="mt-4 text-[13px] text-muted-foreground italic">
                  {worstOverdue === "<14"
                    ? "You're staying close to it. Most freelancers are not."
                    : worstOverdue === "14-30"
                    ? "You're not alone — that's a common range."
                    : worstOverdue === "30-60"
                    ? "That's a lot of head-space rented out for free. We'll tighten the cadence."
                    : "That's the kind of wait we built ChaseHQ to prevent."}
                </p>
              )}
              <button
                onClick={goNext}
                disabled={!worstOverdue}
                className={`mt-5 w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 ease-out active:scale-[0.97] shadow-[0_8px_24px_rgba(91,123,142,0.25)] ${!worstOverdue ? "opacity-40 pointer-events-none shadow-none" : ""}`}
              >
                Got it <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Step 3 — Work Type */}
          {currentStep === 3 && (
            <div className="card-elevated p-5 mt-2">
              <span className="text-xs font-semibold text-primary uppercase tracking-[0.12em]">About you</span>
              <h2 className="text-[clamp(22px,5.5vw,28px)] font-bold text-foreground tracking-[-0.02em] leading-[1.15] mt-2 mb-1">What kind of work do you do?</h2>
              <p className="text-[15px] text-muted-foreground mb-5">We'll calibrate the AI's vocabulary to match.</p>
              <div className="flex flex-col gap-2.5">
                {WORK_TYPE_OPTIONS.map((opt) => {
                  const selected = workType === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setWorkType(opt.id)}
                      className={`relative text-left px-4 py-3.5 rounded-xl border-2 transition-all ${selected ? "border-primary bg-accent/40 shadow-[var(--shadow-card)]" : "border-border bg-card hover:border-primary/30 hover:shadow-[var(--shadow-card)]"}`}
                    >
                      <p className="text-sm font-semibold text-foreground pr-6">{opt.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 pr-6">{opt.desc}</p>
                      {selected && (
                        <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[11px] font-bold">✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={goNext}
                disabled={!workType}
                className={`mt-5 w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 ease-out active:scale-[0.97] shadow-[0_8px_24px_rgba(91,123,142,0.25)] ${!workType ? "opacity-40 pointer-events-none shadow-none" : ""}`}
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Step 4 — Typical Invoice Size */}
          {currentStep === 4 && (
            <div className="card-elevated p-5 mt-2">
              <span className="text-xs font-semibold text-primary uppercase tracking-[0.12em]">Stakes</span>
              <h2 className="text-[clamp(22px,5.5vw,28px)] font-bold text-foreground tracking-[-0.02em] leading-[1.15] mt-2 mb-1">What's a typical invoice for you?</h2>
              <p className="text-[15px] text-muted-foreground mb-5">Bigger invoices need different language. We'll handle that.</p>
              <div className="flex flex-col gap-2.5">
                {INVOICE_SIZE_OPTIONS.map((opt) => {
                  const selected = invoiceSize === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setInvoiceSize(opt.id)}
                      className={`relative text-left px-4 py-3.5 rounded-xl border-2 transition-all ${selected ? "border-primary bg-accent/40 shadow-[var(--shadow-card)]" : "border-border bg-card hover:border-primary/30 hover:shadow-[var(--shadow-card)]"}`}
                    >
                      <p className="text-sm font-semibold text-foreground pr-6">{opt.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 pr-6">{opt.sub}</p>
                      {selected && (
                        <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[11px] font-bold">✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={goNext}
                disabled={!invoiceSize}
                className={`mt-5 w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 ease-out active:scale-[0.97] shadow-[0_8px_24px_rgba(91,123,142,0.25)] ${!invoiceSize ? "opacity-40 pointer-events-none shadow-none" : ""}`}
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Step 5 — Client Load */}
          {currentStep === 5 && (
            <div className="card-elevated p-5 mt-2">
              <span className="text-xs font-semibold text-primary uppercase tracking-[0.12em]">Volume</span>
              <h2 className="text-[clamp(22px,5.5vw,28px)] font-bold text-foreground tracking-[-0.02em] leading-[1.15] mt-2 mb-1">How many clients do you usually juggle?</h2>
              <p className="text-[15px] text-muted-foreground mb-5">Sets the right default for your dashboard and follow-up rhythm.</p>
              <div className="flex flex-col gap-2.5">
                {CLIENT_LOAD_OPTIONS.map((opt) => {
                  const selected = clientLoad === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setClientLoad(opt.id)}
                      className={`relative text-left px-4 py-3.5 rounded-xl border-2 transition-all ${selected ? "border-primary bg-accent/40 shadow-[var(--shadow-card)]" : "border-border bg-card hover:border-primary/30 hover:shadow-[var(--shadow-card)]"}`}
                    >
                      <p className="text-sm font-semibold text-foreground pr-6">{opt.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 pr-6">{opt.sub}</p>
                      {selected && (
                        <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[11px] font-bold">✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={goNext}
                disabled={!clientLoad}
                className={`mt-5 w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 ease-out active:scale-[0.97] shadow-[0_8px_24px_rgba(91,123,142,0.25)] ${!clientLoad ? "opacity-40 pointer-events-none shadow-none" : ""}`}
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Step 6 — Value Promise (How It Works) */}
          {currentStep === 6 && (
            <div className="card-elevated p-5 mt-2">
              <span className="text-xs font-semibold text-primary uppercase tracking-[0.12em]">Why ChaseHQ exists</span>
              <h2 className="text-[clamp(22px,5.5vw,28px)] font-bold text-foreground tracking-[-0.02em] leading-[1.15] mt-2 mb-1">Reminders were never the hard part.</h2>
              <p className="text-[15px] text-muted-foreground mb-5">Writing the message is.</p>
              <div className="flex flex-col gap-2.5 mb-5">
                {[
                  { label: "Words",  title: "What to say",      desc: "Written in the tone you set.",        glyph: "Aa" },
                  { label: "Moment", title: "When to send",     desc: "Sent on the schedule you choose.",    glyph: "⏱" },
                  { label: "Tone",   title: "How to phrase it", desc: "Warm or firm — never awkward.",       glyph: "☺" },
                ].map((f) => (
                  <div key={f.title} className="flex items-start gap-3 bg-background border border-border rounded-xl px-3.5 py-3">
                    <div className="w-9 h-9 rounded-xl bg-accent/60 text-primary flex items-center justify-center shrink-0 text-sm font-bold">
                      {f.glyph}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold text-primary uppercase tracking-[0.12em] mb-0.5">{f.label}</p>
                      <p className="text-sm font-semibold text-foreground leading-tight">{f.title}</p>
                      <p className="text-xs text-muted-foreground leading-[1.45] mt-0.5">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground italic mb-5">The whole conversation, off your plate.</p>
              <button
                onClick={goNext}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 ease-out active:scale-[0.97] shadow-[0_8px_24px_rgba(91,123,142,0.25)]"
              >
                Okay, I'm In <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Step 7 — Tone */}
          {currentStep === 7 && (
            <div className="card-elevated p-5 mt-2">
              <span className="text-xs font-semibold text-primary uppercase tracking-[0.12em]">Personalize</span>
              <h2 className="text-[clamp(22px,5.5vw,28px)] font-bold text-foreground tracking-[-0.02em] leading-[1.15] mt-2 mb-1">Pick your follow-up style.</h2>
              <p className="text-[15px] text-muted-foreground mb-5">You can adjust anytime.</p>
              <div className="flex flex-col gap-2.5">
                {STYLE_OPTIONS.map((opt) => {
                  const selected = followUpStyle === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setFollowUpStyle(opt.id)}
                      style={{ touchAction: "manipulation" }}
                      className={`relative text-left px-4 py-3.5 rounded-xl border-2 transition-all ${selected ? "border-primary bg-accent/40 shadow-[var(--shadow-card)]" : "border-border bg-card hover:border-primary/30 hover:shadow-[var(--shadow-card)]"}`}
                    >
                      <p className="text-sm font-semibold text-foreground pr-6">{opt.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 pr-6">{opt.desc}</p>
                      {selected && (
                        <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[11px] font-bold">✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => { if (followUpStyle) goNext(); }}
                aria-disabled={!followUpStyle}
                className={`mt-5 w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 ease-out active:scale-[0.97] shadow-[0_8px_24px_rgba(91,123,142,0.25)] ${followUpStyle ? "" : "opacity-40 pointer-events-none shadow-none"}`}
              >
                Set My Style <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Step 8 — Chase Schedule (with recommendation) */}
          {currentStep === 8 && (
            <div className="card-elevated p-5 mt-2">
              <span className="text-xs font-semibold text-primary uppercase tracking-[0.12em]">Chase rhythm</span>
              <h2 className="text-[clamp(22px,5.5vw,28px)] font-bold text-foreground tracking-[-0.02em] leading-[1.15] mt-2 mb-1">When should ChaseHQ follow up?</h2>
              <p className="text-[15px] text-muted-foreground mb-3">We recommended one based on your answers — change it if you prefer.</p>
              <div className="flex items-center gap-2 bg-accent/40 border border-primary/30 rounded-xl px-3 py-2 mb-4">
                <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                <p className="text-[12px] text-foreground leading-snug">{reasonLine}</p>
              </div>
              <div className="flex flex-col gap-2.5">
                {SCHEDULE_OPTIONS.map((opt) => {
                  const selected = chaseSchedule === opt.id;
                  const recommended = recommendation.preset === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setChaseSchedule(opt.id)}
                      className={`relative text-left px-4 py-3.5 rounded-xl border-2 transition-all ${selected ? "border-primary bg-accent/40 shadow-[var(--shadow-card)]" : "border-border bg-card hover:border-primary/30 hover:shadow-[var(--shadow-card)]"}`}
                    >
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                        {recommended && (
                          <span className="text-[10px] font-bold text-primary uppercase tracking-[0.1em] bg-primary/10 rounded-full px-2 py-0.5">Recommended</span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 font-mono tracking-tight">{opt.cadence}</p>
                      <p className="text-xs text-muted-foreground mt-1.5 pr-6">{opt.desc}</p>
                      {selected && (
                        <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[11px] font-bold">✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={goNext}
                disabled={!chaseSchedule}
                className={`mt-5 w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 ease-out active:scale-[0.97] shadow-[0_8px_24px_rgba(91,123,142,0.25)] ${!chaseSchedule ? "opacity-40 pointer-events-none shadow-none" : ""}`}
              >
                Lock It In <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Step 9 — Signature */}
          {currentStep === 9 && (
            <div className="card-elevated p-5 mt-2">
              <span className="text-xs font-semibold text-primary uppercase tracking-[0.12em]">Your voice</span>
              <h2 className="text-[clamp(22px,5.5vw,28px)] font-bold text-foreground tracking-[-0.02em] leading-[1.15] mt-2 mb-1">How should we sign your follow-ups?</h2>
              <p className="text-[15px] text-muted-foreground mb-5">Goes at the bottom of every message ChaseHQ writes for you.</p>
              <input
                type="text"
                value={signatureName}
                onChange={(e) => setSignatureName(e.target.value)}
                placeholder="Your name (or 'Alex, Studio Westgate')"
                className="w-full px-4 py-3.5 rounded-xl border-2 border-border bg-card text-sm font-medium text-foreground focus:outline-none focus:border-primary transition-colors"
                autoComplete="name"
                maxLength={80}
              />
              {signatureName.trim() && (
                <div className="mt-4 px-4 py-3 bg-muted/50 border border-border rounded-xl">
                  <p className="text-[11px] font-semibold text-primary uppercase tracking-[0.12em] mb-1">Preview</p>
                  <p className="text-sm text-muted-foreground italic">…feel free to reach out if you have any questions.</p>
                  <p className="text-sm text-foreground font-semibold mt-2">— {signatureName.trim()}</p>
                </div>
              )}
              <button
                onClick={goNext}
                disabled={!signatureName.trim()}
                className={`mt-5 w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 ease-out active:scale-[0.97] shadow-[0_8px_24px_rgba(91,123,142,0.25)] ${!signatureName.trim() ? "opacity-40 pointer-events-none shadow-none" : ""}`}
              >
                That's Me <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Step 10 — Theatrical Calibration */}
          {currentStep === 10 && (
            <CalibratingSlide onDone={goNext} workType={workType} clientLoad={clientLoad} />
          )}

          {/* Step 11 — Plan Ready */}
          {currentStep === 11 && (
            <div className="card-elevated p-5 mt-2">
              <span className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">✦ Calibrated</span>
              <h2 className="text-[clamp(22px,5.5vw,28px)] font-bold text-foreground tracking-[-0.02em] leading-[1.15] mt-2 mb-1">Your plan is ready.</h2>
              <p className="text-[15px] text-muted-foreground mb-5">ChaseHQ — calibrated for {signatureName.trim() || "you"}.</p>
              <div className="flex flex-col gap-2.5 mb-5">
                <PlanRow label="Tone"          value={followUpStyle ? STYLE_OPTIONS.find(o => o.id === followUpStyle)?.label ?? "—" : "—"} />
                <PlanRow label="Schedule"      value={SCHEDULE_OPTIONS.find(o => o.id === (chaseSchedule ?? recommendation.preset))?.label ?? "—"} />
                <PlanRow label="Work type"     value={WORK_TYPE_OPTIONS.find(o => o.id === workType)?.label ?? "—"} />
                <PlanRow label="Typical invoice" value={INVOICE_SIZE_OPTIONS.find(o => o.id === invoiceSize)?.label ?? "—"} />
                <PlanRow label="Signature"     value={signatureName.trim() || "—"} />
              </div>
              <p className="text-xs text-muted-foreground italic mb-5">Edit anytime in Settings.</p>
              <button
                onClick={goNext}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 ease-out active:scale-[0.97] shadow-[0_8px_24px_rgba(91,123,142,0.25)]"
              >
                Looks Right <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Step 12 — The Hard Part Is Over (now earned) */}
          {currentStep === 12 && (
            <div className="mt-2 flex flex-col items-center text-center pt-10">
              <span className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">✦ You're In</span>
              <h2 className="text-[clamp(28px,7vw,40px)] font-bold text-foreground tracking-[-0.03em] leading-[1.05] mt-3 mb-3">The hard part is over.</h2>
              <p className="text-[16px] text-muted-foreground leading-[1.55] max-w-xs">
                ChaseHQ knows your tone, your schedule, your style. Now let's get paid.
              </p>
              <button
                onClick={handleFinishOnboarding}
                className="mt-10 w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 ease-out active:scale-[0.97] shadow-[0_8px_24px_rgba(91,123,142,0.25)] hover:shadow-[0_12px_32px_rgba(91,123,142,0.30)]"
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

function PlanRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 bg-background border border-border rounded-xl">
      <span className="text-[11px] font-semibold text-primary uppercase tracking-[0.12em]">{label}</span>
      <span className="text-sm font-semibold text-foreground text-right">{value}</span>
    </div>
  );
}

const CALIBRATION_STEPS = [
  "Calibrating tone…",
  "Locking your schedule…",
  "Priming follow-up templates…",
  "Storing your signature…",
];

function CalibratingSlide({ onDone, workType, clientLoad }: { onDone: () => void; workType: WorkType | null; clientLoad: ClientLoadBucket | null }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [done, setDone] = useState<boolean[]>(() => CALIBRATION_STEPS.map(() => false));
  const triggeredRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const ms = 900;
    const timers: number[] = [];
    CALIBRATION_STEPS.forEach((_, i) => {
      timers.push(window.setTimeout(() => {
        if (cancelled) return;
        setActiveIdx(i + 1);
        setDone((prev) => prev.map((v, idx) => idx <= i ? true : v));
      }, ms * (i + 1)));
    });
    timers.push(window.setTimeout(() => {
      if (cancelled || triggeredRef.current) return;
      triggeredRef.current = true;
      onDone();
    }, ms * (CALIBRATION_STEPS.length + 1)));
    return () => {
      cancelled = true;
      timers.forEach(window.clearTimeout);
    };
  }, [onDone]);

  const subtitle = workType && clientLoad
    ? `For a ${WORK_TYPE_OPTIONS.find(o => o.id === workType)?.label.toLowerCase() ?? "freelancer"} with ${clientLoad === "10+" ? "10+" : clientLoad} clients.`
    : "Setting up your account.";

  return (
    <div className="card-elevated p-5 mt-2">
      <span className="text-xs font-semibold text-primary uppercase tracking-[0.12em]">Setting up</span>
      <h2 className="text-[clamp(22px,5.5vw,28px)] font-bold text-foreground tracking-[-0.02em] leading-[1.15] mt-2 mb-1">Calibrating your follow-up engine…</h2>
      <p className="text-[15px] text-muted-foreground mb-6">{subtitle}</p>
      <div className="flex flex-col gap-2.5">
        {CALIBRATION_STEPS.map((step, i) => {
          const isDone = done[i];
          const isActive = activeIdx === i && !isDone;
          return (
            <div key={step} className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${isDone ? "border-primary bg-accent/40" : "border-border bg-card"}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all ${isDone ? "bg-primary text-primary-foreground" : "border-2 border-border"}`}>
                {isDone ? (
                  <Check className="w-3.5 h-3.5" />
                ) : isActive ? (
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                ) : null}
              </div>
              <p className={`text-sm font-medium transition-colors ${isDone ? "text-foreground" : "text-muted-foreground"}`}>
                {isDone ? step.replace("…", " — done") : step}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
