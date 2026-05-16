import { useState } from "react";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import { type SchedulePreset, type ScheduleStep, PRESET_STEPS, getDefaultStepsForInvoice } from "@/lib/scheduleDefaults";
import { ChevronDown } from "lucide-react";

const ONBOARDING_STORAGE_KEY = STORAGE_KEYS.ONBOARDING_V5;

export function deriveOnboardingDefaults(): { tone: "Friendly" | "Firm"; preset: "patient" | "light" | "active" } {
  try {
    const raw = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!raw) return { tone: "Friendly", preset: "patient" };
    const data = JSON.parse(raw);
    const toneMap: Record<string, "Friendly" | "Firm"> = { friendly: "Friendly", firm: "Firm" };
    const presetMap: Record<string, "patient" | "light" | "active"> = { wait: "patient", nudge: "light", persist: "active" };
    return {
      tone: toneMap[data?.tone_preference] ?? "Friendly",
      preset: presetMap[data?.chase_instinct] ?? "patient",
    };
  } catch { return { tone: "Friendly", preset: "patient" }; }
}

const SCHEDULE_TONE_OPTIONS: ScheduleStep["tone"][] = ["Friendly", "Firm", "Urgent", "Final Notice"];

const descriptions: Record<SchedulePreset, { tagline: string; cadence: string; tones: string }> = {
  active:  { tagline: "Pay attention",       cadence: "Day 3 · 7 · 14 · 21",   tones: "Friendly → Firm → Urgent → Final Notice" },
  patient: { tagline: "Steady professional", cadence: "Day 5 · 13 · 20 · 23",  tones: "Friendly → Friendly → Firm → Final Notice" },
  light:   { tagline: "Relationship-first",  cadence: "Day 7 · 14 · 21 · 28",  tones: "Friendly → Friendly → Firm → Firm" },
};

export function ScheduleSection() {
  const [preset, setPreset] = useState<SchedulePreset>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.SCHEDULE_PRESET) as SchedulePreset | null;
    return stored ?? deriveOnboardingDefaults().preset;
  });

  const [savedCustom, setSavedCustom] = useState<ScheduleStep[] | null>(() => {
    const raw = localStorage.getItem(STORAGE_KEYS.SCHEDULE_CUSTOM_STEPS);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length ? parsed : null;
    } catch { return null; }
  });

  const [draftSteps, setDraftSteps] = useState<ScheduleStep[]>(() => getDefaultStepsForInvoice());
  const [confirmPreset, setConfirmPreset] = useState<SchedulePreset | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  const hasCustom = savedCustom !== null;
  const baseSteps = savedCustom ?? PRESET_STEPS[preset];
  const isDirty = JSON.stringify(draftSteps) !== JSON.stringify(baseSteps);

  function applyPreset(p: SchedulePreset) {
    setPreset(p);
    try { localStorage.setItem(STORAGE_KEYS.SCHEDULE_PRESET, p); } catch {}
    try { localStorage.removeItem(STORAGE_KEYS.SCHEDULE_CUSTOM_STEPS); } catch {}
    setSavedCustom(null);
    setDraftSteps(PRESET_STEPS[p].map((s) => ({ ...s })));
    setConfirmPreset(null);
  }

  function pickPreset(p: SchedulePreset) {
    if (hasCustom && p !== preset) { setConfirmPreset(p); } else { applyPreset(p); }
  }

  function updateOffset(idx: number, val: number) {
    setDraftSteps((prev) => prev.map((s, i) => i === idx ? { ...s, offset_days: Math.max(1, val) } : s));
  }

  function updateTone(idx: number, tone: ScheduleStep["tone"]) {
    const type: ScheduleStep["type"] = (tone === "Final Notice" || tone === "Urgent") ? "escalation" : "followup";
    setDraftSteps((prev) => prev.map((s, i) => i === idx ? { ...s, tone, type } : s));
  }

  function removeStep(idx: number) {
    if (draftSteps.length <= 1) return;
    setDraftSteps((prev) => prev.filter((_, i) => i !== idx));
  }

  function addStep() {
    const lastOffset = draftSteps[draftSteps.length - 1]?.offset_days ?? 7;
    setDraftSteps((prev) => [...prev, { offset_days: lastOffset + 7, tone: "Firm", type: "followup", status: "pending" }]);
  }

  function resetToPreset() {
    try { localStorage.removeItem(STORAGE_KEYS.SCHEDULE_CUSTOM_STEPS); } catch {}
    setSavedCustom(null);
    setDraftSteps(PRESET_STEPS[preset].map((s) => ({ ...s })));
  }

  function handleSave() {
    const steps = [...draftSteps];
    try { localStorage.setItem(STORAGE_KEYS.SCHEDULE_CUSTOM_STEPS, JSON.stringify(steps)); } catch {}
    setSavedCustom(steps);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2500);
  }

  function handleDiscard() {
    setDraftSteps(baseSteps.map((s) => ({ ...s })));
  }

  return (
    <div className="flex flex-col gap-3">
      {(["active", "patient", "light"] as SchedulePreset[]).map((p) => {
        const isActive = preset === p;
        const showCustom = isActive && hasCustom;
        const cadence = showCustom ? savedCustom!.map((s) => `Day ${s.offset_days}`).join(" · ") : descriptions[p].cadence;
        const tones = showCustom ? savedCustom!.map((s) => s.tone).join(" → ") : descriptions[p].tones;
        return (
          <button
            key={p}
            onClick={() => pickPreset(p)}
            className={`text-left px-3.5 py-3 rounded-xl border-[1.5px] transition-colors ${isActive ? "border-primary bg-accent" : "border-border bg-card"}`}
          >
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-sm font-semibold text-foreground capitalize">{p} <span className="font-normal text-muted-foreground">· {descriptions[p].tagline}</span></p>
              {showCustom && (
                <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/10 text-primary">Custom</span>
              )}
            </div>
            <p className="text-[11px] font-mono text-muted-foreground mt-0.5">{cadence}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{tones}</p>
          </button>
        );
      })}

      <div className="border border-border rounded-xl overflow-hidden">
        <button
          onClick={() => setCustomOpen((o) => !o)}
          className="w-full flex items-center justify-between px-3.5 py-2.5 text-left"
        >
          <span className="text-xs font-semibold text-foreground">Customize your default</span>
          <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${customOpen ? "rotate-180" : ""}`} />
        </button>
        {customOpen && (
          <div className="border-t border-border px-3.5 pb-3.5 pt-2.5">
            <div className="flex flex-col gap-1">
              {draftSteps.map((step, idx) => (
                <div key={idx} className="flex items-center gap-1.5 flex-wrap py-1">
                  <select
                    value={step.tone}
                    onChange={(e) => updateTone(idx, e.target.value as ScheduleStep["tone"])}
                    className="text-xs bg-muted border border-border rounded-md px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                  >
                    {SCHEDULE_TONE_OPTIONS.map((t) => <option key={t}>{t}</option>)}
                  </select>
                  <span className="text-xs text-muted-foreground">+</span>
                  <input
                    type="number"
                    min={1}
                    value={step.offset_days}
                    onChange={(e) => updateOffset(idx, parseInt(e.target.value) || 1)}
                    className="w-14 px-2 py-1 text-xs font-bold text-primary bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <span className="text-xs text-muted-foreground flex-1">days after due</span>
                  {draftSteps.length > 1 && (
                    <button
                      onClick={() => removeStep(idx)}
                      className="text-muted-foreground hover:text-destructive text-xs px-1.5 py-0.5 rounded transition-colors"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2.5">
              <button onClick={addStep} className="text-xs text-primary font-semibold hover:opacity-80 transition-opacity">
                + Add step
              </button>
              <span className="text-muted-foreground text-xs">·</span>
              <button onClick={resetToPreset} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Reset to {preset.charAt(0).toUpperCase() + preset.slice(1)}
              </button>
            </div>
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border">
              <button
                onClick={handleSave}
                disabled={!isDirty}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${isDirty ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-muted text-muted-foreground cursor-default"}`}
              >
                Save
              </button>
              {isDirty && (
                <button onClick={handleDiscard} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Discard
                </button>
              )}
              {savedMsg && !isDirty && (
                <span className="text-xs text-green-600 dark:text-green-400">Saved. New invoices will use this schedule.</span>
              )}
            </div>
          </div>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground px-1">Applies to new invoices only. To change a specific invoice, edit it from its detail page.</p>

      {confirmPreset && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6" onClick={() => setConfirmPreset(null)}>
          <div className="bg-card border border-border rounded-2xl p-5 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-bold text-foreground mb-1">Replace your custom schedule?</p>
            <p className="text-xs text-muted-foreground mb-4">Switching to {confirmPreset.charAt(0).toUpperCase() + confirmPreset.slice(1)} will clear your customizations.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmPreset(null)} className="flex-1 py-2 rounded-xl border border-border text-xs font-medium text-foreground">Cancel</button>
              <button onClick={() => applyPreset(confirmPreset)} className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold">Switch to {confirmPreset.charAt(0).toUpperCase() + confirmPreset.slice(1)}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
