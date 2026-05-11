import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import { type SchedulePreset, type ScheduleStep, PRESET_STEPS, getDefaultStepsForInvoice } from "@/lib/scheduleDefaults";
import {
  ChevronDown, LogOut, Sparkles,
  User as UserIcon, Bell, Shield, Download, FileText, ScrollText, AlertTriangle, CreditCard, ChevronRight,
} from "lucide-react";
import { requestLocalNotificationPermission, cancelAllPending } from "@/lib/localNotifications";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toTitleCase } from "@/lib/textCase";

const ONBOARDING_STORAGE_KEY = "onboarding_v5";

function deriveOnboardingDefaults(): { tone: "Friendly" | "Firm" | "Urgent"; preset: "patient" | "light" | "active" } {
  try {
    const raw = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!raw) return { tone: "Friendly", preset: "patient" };
    const data = JSON.parse(raw);
    const toneMap: Record<string, "Friendly" | "Firm" | "Urgent"> = { friendly: "Friendly", firm: "Firm", urgent: "Urgent" };
    const presetMap: Record<string, "patient" | "light" | "active"> = { wait: "patient", nudge: "light", persist: "active" };
    return {
      tone: toneMap[data?.tone_preference] ?? "Friendly",
      preset: presetMap[data?.chase_instinct] ?? "patient",
    };
  } catch { return { tone: "Friendly", preset: "patient" }; }
}
import { Switch } from "@/components/ui/switch";
import { useInvoices } from "@/hooks/useSupabaseData";
import { countReflowEligibleInvoices, reflowDefaultScheduleToInvoices } from "@/hooks/useNotifications";
import { useEntitlement } from "@/hooks/useEntitlement";
import { supabase } from "@/integrations/supabase/client";
import { FLOW_STORAGE_KEY } from "@/flow/states";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import NotificationBell from "@/components/NotificationBell";
import { useFlow } from "@/flow/FlowMachine";
import type { WorkType, InvoiceSizeBucket, ClientLoadBucket } from "@/lib/userProfile/types";
import {
  writeWorkType, writeInvoiceSize, writeClientLoad,
  clearLocalUserProfile, clearDemoUserProfile,
} from "@/lib/userProfile/storage";
import { displayNamePromptShownKey } from "@/lib/storageKeys";

type SectionKey = "notifications" | "schedule" | "personalization" | "data" | null;

function CollapsibleSection({ title, subtitle, isOpen, onToggle, children }: {
  title: string; subtitle: string; isOpen: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className={`bg-card border rounded-2xl overflow-hidden transition-colors shadow-[var(--shadow-card)] ${isOpen ? "border-primary" : "border-border"}`}>
      <button onClick={onToggle} className="w-full flex items-center justify-between p-4 text-left">
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>
      {isOpen && <div className="border-t border-border p-4">{children}</div>}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs uppercase tracking-[0.12em] font-semibold text-primary mb-2.5 px-1">
      {children}
    </p>
  );
}

const DEFAULT_TONES = ["Friendly", "Firm", "Urgent"] as const;

function NotificationsSection({ notifications, updateNotifications }: {
  notifications: { emailNotifications: boolean; autoChase: boolean; defaultTone: string };
  updateNotifications: (n: any) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {[
        { label: "Email Notifications", sub: "Get an email when a follow-up is due to send", key: "emailNotifications" as const },
        { label: "Push Reminders", sub: "Notify me when it's time to send the next follow-up", key: "autoChase" as const },
      ].map((item) => (
        <div key={item.key} className="flex items-center justify-between">
          <div className="flex-1 pr-4">
            <p className="text-sm font-semibold text-foreground">{item.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{item.sub}</p>
          </div>
          <Switch
            checked={notifications[item.key]}
            onCheckedChange={(checked) => updateNotifications({ ...notifications, [item.key]: checked })}
          />
        </div>
      ))}
      <div>
        <p className="text-sm font-semibold text-foreground mb-1">Default tone</p>
        <p className="text-xs text-muted-foreground mb-2.5">Applied when drafting follow-ups</p>
        <div className="flex flex-wrap gap-2">
          {DEFAULT_TONES.map((tone) => (
            <button
              key={tone}
              onClick={() => updateNotifications({ ...notifications, defaultTone: tone })}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                notifications.defaultTone === tone
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {tone}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const SCHEDULE_TONE_OPTIONS: ScheduleStep["tone"][] = ["Friendly", "Firm", "Urgent", "Final Notice"];

function ScheduleSection() {
  const { user } = useApp();
  const [preset, setPreset] = useState<SchedulePreset>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.SCHEDULE_PRESET) as SchedulePreset | null;
    return stored ?? deriveOnboardingDefaults().preset;
  });

  // Count of existing invoices the "apply default" action would rebuild (unpaid,
  // not paused, not yet started chasing). Lazily fetched; null = still loading / no user.
  const [eligibleCount, setEligibleCount] = useState<number | null>(null);
  const [confirmApply, setConfirmApply] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!user?.id) { setEligibleCount(null); return; }
    let cancelled = false;
    countReflowEligibleInvoices(user.id)
      .then((c) => { if (!cancelled) setEligibleCount(c); })
      .catch(() => { if (!cancelled) setEligibleCount(null); });
    return () => { cancelled = true; };
  }, [user?.id]);

  async function runReflow() {
    if (!user?.id || applying) return;
    setApplying(true);
    try {
      const { updated } = await reflowDefaultScheduleToInvoices(user.id);
      toast.success(
        updated > 0
          ? `Updated ${updated} invoice${updated === 1 ? "" : "s"} to your default schedule.`
          : "No invoices needed updating.",
      );
    } catch (e) {
      console.error("[ScheduleSection] reflow failed:", e);
      toast.error("Couldn't apply the schedule — give it another try.");
    } finally {
      setApplying(false);
      setConfirmApply(false);
      if (user?.id) countReflowEligibleInvoices(user.id).then(setEligibleCount).catch(() => {});
    }
  }

  // savedCustom: steps committed to localStorage (null = no custom override, use preset)
  const [savedCustom, setSavedCustom] = useState<ScheduleStep[] | null>(() => {
    const raw = localStorage.getItem(STORAGE_KEYS.SCHEDULE_CUSTOM_STEPS);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length ? parsed : null;
    } catch { return null; }
  });

  // draftSteps: what the user is currently editing (may differ from savedCustom until Save)
  const [draftSteps, setDraftSteps] = useState<ScheduleStep[]>(() => getDefaultStepsForInvoice());

  const [confirmPreset, setConfirmPreset] = useState<SchedulePreset | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  const hasCustom = savedCustom !== null;
  const baseSteps = savedCustom ?? PRESET_STEPS[preset];
  const isDirty = JSON.stringify(draftSteps) !== JSON.stringify(baseSteps);

  // Best-effort mirror of the schedule prefs onto notification_preferences so they
  // follow the account across reinstall / new device. local is authoritative on
  // this device regardless; the next change retries if this fails.
  function pushScheduleToServer(presetVal: SchedulePreset, stepsVal: ScheduleStep[] | null) {
    if (!user?.id) return;
    supabase
      .from("notification_preferences")
      .upsert(
        { user_id: user.id, schedule_preset: presetVal, schedule_steps: stepsVal },
        { onConflict: "user_id" },
      )
      .then(
        ({ error }) => { if (error) console.warn("[ScheduleSection] schedule prefs upsert failed:", error.message); },
        (e) => console.warn("[ScheduleSection] schedule prefs upsert threw:", e),
      );
  }

  function applyPreset(p: SchedulePreset) {
    setPreset(p);
    try { localStorage.setItem(STORAGE_KEYS.SCHEDULE_PRESET, p); } catch {}
    try { localStorage.removeItem(STORAGE_KEYS.SCHEDULE_CUSTOM_STEPS); } catch {}
    setSavedCustom(null);
    setDraftSteps(PRESET_STEPS[p].map((s) => ({ ...s })));
    setConfirmPreset(null);
    pushScheduleToServer(p, null);
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
    pushScheduleToServer(preset, null);
  }

  function handleSave() {
    const steps = [...draftSteps];
    try { localStorage.setItem(STORAGE_KEYS.SCHEDULE_CUSTOM_STEPS, JSON.stringify(steps)); } catch {}
    setSavedCustom(steps);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2500);
    pushScheduleToServer(preset, steps);
  }

  function handleDiscard() {
    setDraftSteps(baseSteps.map((s) => ({ ...s })));
  }

  const descriptions: Record<SchedulePreset, { tagline: string; cadence: string; tones: string }> = {
    active:  { tagline: "Pay attention",       cadence: "Day 3 · 7 · 14 · 21",   tones: "Friendly → Firm → Urgent → Final Notice" },
    patient: { tagline: "Steady professional", cadence: "Day 5 · 13 · 20 · 23",  tones: "Friendly → Friendly → Firm → Final Notice" },
    light:   { tagline: "Relationship-first",  cadence: "Day 7 · 14 · 21 · 28",  tones: "Friendly → Friendly → Firm → Firm" },
  };

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
            className={`text-left px-3.5 py-3 rounded-xl transition-colors ${isActive ? "border-2 border-primary bg-accent shadow-[var(--shadow-card)]" : "border border-border bg-card"}`}
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

      {/* Customize default schedule */}
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
              {[...draftSteps]
                .map((step, idx) => ({ step, idx }))
                .sort((a, b) => b.step.offset_days - a.step.offset_days)
                .map(({ step, idx }) => (
                <div key={idx} className="flex items-center gap-1.5 flex-wrap py-1">
                  <button
                    type="button"
                    onClick={() => {
                      const next = SCHEDULE_TONE_OPTIONS[(SCHEDULE_TONE_OPTIONS.indexOf(step.tone) + 1) % SCHEDULE_TONE_OPTIONS.length];
                      updateTone(idx, next);
                    }}
                    className="flex items-center gap-1 text-xs bg-muted border border-border rounded-md px-2.5 py-1 text-foreground hover:border-primary/40 transition-colors"
                  >
                    {step.tone} <ChevronDown className="w-3 h-3 opacity-50" />
                  </button>
                  <span className="text-xs text-muted-foreground">+</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={step.offset_days}
                    onChange={(e) => updateOffset(idx, parseInt(e.target.value.replace(/\D/g, "")) || 1)}
                    onKeyDown={(e) => e.stopPropagation()}
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
              <button
                onClick={addStep}
                className="text-xs text-primary font-semibold hover:opacity-80 transition-opacity"
              >
                + Add step
              </button>
              <span className="text-muted-foreground text-xs">·</span>
              <button
                onClick={resetToPreset}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
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
                <button
                  onClick={handleDiscard}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
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

      <p className="text-[11px] text-muted-foreground px-1">New invoices use this schedule automatically. Apply it to invoices already in flight with the button below, or edit any one invoice from its detail page.</p>

      {eligibleCount !== null && eligibleCount > 0 && (
        <button
          onClick={() => setConfirmApply(true)}
          disabled={applying}
          className="text-left px-3.5 py-3 rounded-xl border border-border bg-card hover:bg-accent transition-colors disabled:opacity-60"
        >
          <p className="text-xs font-semibold text-foreground">
            {applying ? "Applying…" : `Apply to ${eligibleCount} existing invoice${eligibleCount === 1 ? "" : "s"}`}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Rebuilds the follow-up schedule for invoices that haven't started chasing yet. Paid and in-progress invoices stay as they are.
          </p>
        </button>
      )}

      {/* Confirm preset switch when custom steps exist */}
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

      {/* Confirm applying the default to existing invoices */}
      {confirmApply && eligibleCount !== null && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6" onClick={() => { if (!applying) setConfirmApply(false); }}>
          <div className="bg-card border border-border rounded-2xl p-5 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-bold text-foreground mb-1">Apply to {eligibleCount} existing invoice{eligibleCount === 1 ? "" : "s"}?</p>
            <p className="text-xs text-muted-foreground mb-4">Rebuilds the follow-up schedule for invoices that haven't started chasing yet — any per-invoice tweaks on those will be reset. Paid and in-progress invoices are untouched.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmApply(false)} disabled={applying} className="flex-1 py-2 rounded-xl border border-border text-xs font-medium text-foreground disabled:opacity-60">Cancel</button>
              <button onClick={runReflow} disabled={applying} className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-60">{applying ? "Applying…" : "Apply"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


const WORK_TYPE_LABELS: Record<WorkType, string> = {
  designer: "Designer",
  developer: "Developer",
  writer: "Writer",
  consultant: "Consultant",
  agency: "Agency or studio",
  other: "Something else",
};
const INVOICE_SIZE_LABELS: Record<InvoiceSizeBucket, string> = {
  "<500": "Under $500",
  "500-2k": "$500 to $2,000",
  "2k-10k": "$2,000 to $10,000",
  "10k+": "$10,000+",
};
const CLIENT_LOAD_LABELS: Record<ClientLoadBucket, string> = {
  "1-3": "1 to 3 clients",
  "4-10": "4 to 10 clients",
  "10+": "More than 10",
};

function PersonalizationSection() {
  const { userProfile, refreshUserProfile } = useApp();

  function pickWorkType(v: WorkType) {
    writeWorkType(v);
    refreshUserProfile();
  }
  function pickInvoiceSize(v: InvoiceSizeBucket) {
    writeInvoiceSize(v);
    refreshUserProfile();
  }
  function pickClientLoad(v: ClientLoadBucket) {
    writeClientLoad(v);
    refreshUserProfile();
  }
  const PillRow = <T extends string>({ label, value, options, labels, onPick }: {
    label: string;
    value: T | undefined;
    options: T[];
    labels: Record<T, string>;
    onPick: (v: T) => void;
  }) => (
    <div className="py-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const selected = value === opt;
          return (
            <button
              key={opt}
              onClick={() => onPick(opt)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:border-primary/40"}`}
            >
              {labels[opt]}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col divide-y divide-border -mx-4 -my-4 px-4">
      <PillRow
        label="Work type"
        value={userProfile.workType}
        options={["designer", "developer", "writer", "consultant", "agency", "other"]}
        labels={WORK_TYPE_LABELS}
        onPick={pickWorkType}
      />
      <PillRow
        label="Typical invoice size"
        value={userProfile.invoiceSize}
        options={["<500", "500-2k", "2k-10k", "10k+"]}
        labels={INVOICE_SIZE_LABELS}
        onPick={pickInvoiceSize}
      />
      <PillRow
        label="Client load"
        value={userProfile.clientLoad}
        options={["1-3", "4-10", "10+"]}
        labels={CLIENT_LOAD_LABELS}
        onPick={pickClientLoad}
      />
      <p className="text-[11px] text-muted-foreground italic pt-3">
        These calibrate AI drafts and the default schedule. Changes apply to new follow-ups.
      </p>
    </div>
  );
}

export default function SettingsScreen() {
  const navigate = useNavigate();
  const { send: flowSend } = useFlow();
  const { user, isAuthenticated, fullName, notifications, updateNotifications, updateDisplayName, signOut } = useApp();
  const [editName, setEditName] = useState(toTitleCase(fullName || ""));
  const [nameSaved, setNameSaved] = useState(false);
  const nameSavedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setEditName(toTitleCase(fullName || "")); }, [fullName]);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEYS.SCHEDULE_PRESET)) {
      const { tone, preset } = deriveOnboardingDefaults();
      if (notifications.defaultTone === "Friendly") {
        updateNotifications({ ...notifications, defaultTone: tone });
      }
      try { localStorage.setItem(STORAGE_KEYS.SCHEDULE_PRESET, preset); } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSaveName() {
    const trimmed = toTitleCase(editName.trim());
    if (trimmed === toTitleCase(fullName || "")) return;
    await updateDisplayName(trimmed || null);
    if (nameSavedTimerRef.current) clearTimeout(nameSavedTimerRef.current);
    setNameSaved(true);
    nameSavedTimerRef.current = setTimeout(() => setNameSaved(false), 1500);
  }
  const { invoices } = useInvoices();
  const ent = useEntitlement();
  const [openSection, setOpenSection] = useState<SectionKey>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  function toggleSection(key: SectionKey) { setOpenSection((prev) => (prev === key ? null : key)); }

  async function handleSignOut() { await signOut(); navigate("/welcome", { replace: true }); }



  async function handleExport() {
    if (!user || exporting) return;
    setExporting(true);
    try {
      const provider = (user.app_metadata as any)?.provider;
      const providers = (user.app_metadata as any)?.providers as string[] | undefined;
      const signedInWithGoogle = provider === "google" || (providers?.includes("google") ?? false);
      const [
        followupsRes, profileRes, prefsRes, sendLogRes,
        scheduleRes, subscriptionsRes, subEventsRes, gmailRes, smtpRes, notificationsRes,
      ] = await Promise.all([
        supabase.from("followups").select("invoice_id, subject, tone, is_ai_generated, sent_at").eq("user_id", user.id),
        supabase.from("profiles").select("full_name, onboarding_completed").eq("user_id", user.id).maybeSingle(),
        supabase.from("notification_preferences").select("enabled, email_enabled, quiet_hours_start, quiet_hours_end, timezone, schedule_preset, schedule_steps, default_tone").eq("user_id", user.id).maybeSingle(),
        supabase.from("email_send_log").select("recipient, invoice_id, sent_at").eq("user_id", user.id),
        supabase.from("followup_schedules").select("invoice_id, steps, created_at, updated_at").eq("user_id", user.id),
        supabase.from("subscriptions").select("status, plan, trial_ends_at, current_period_end, created_at, updated_at").eq("user_id", user.id).maybeSingle(),
        supabase.from("subscription_events").select("event_type, payload, created_at").eq("user_id", user.id),
        supabase.from("gmail_connections").select("email, created_at, updated_at, token_expires_at").eq("user_id", user.id).maybeSingle(),
        supabase.from("smtp_connections").select("from_email, from_name, smtp_host, smtp_port, smtp_username, verified, created_at").eq("user_id", user.id).maybeSingle(),
        supabase.from("notifications").select("invoice_id, schedule_step_index, type, title, body, scheduled_for, status, delivered_at, read_at, created_at").eq("user_id", user.id),
      ]);

      // supabase-js doesn't reject on a query error — it returns { data: null, error }.
      // If ANY query failed, refuse to write a partial export that silently shows
      // those tables as null.
      const results = [followupsRes, profileRes, prefsRes, sendLogRes, scheduleRes, subscriptionsRes, subEventsRes, gmailRes, smtpRes, notificationsRes];
      if (results.some((r) => r.error)) {
        console.warn("[SettingsScreen] export query failed:", results.find((r) => r.error)?.error?.message);
        toast.error("We couldn't export everything just now — try again.");
        return;
      }

      const payload = {
        exportedAt: new Date().toISOString(),
        dataController: "ChaseHQ",
        requestedBy: user.email,
        account: {
          email: user.email,
          authMethod: signedInWithGoogle ? "Google" : "Email",
          fullName: profileRes.data?.full_name ?? null,
          accountCreated: (user as any).created_at ?? null,
        },
        invoices,
        followupsSent: followupsRes.data ?? [],
        followupSchedules: scheduleRes.data ?? [],
        emailSendLog: sendLogRes.data ?? [],
        notificationPreferences: prefsRes.data ?? null,
        notifications: notificationsRes.data ?? [],
        subscription: subscriptionsRes.data ?? null,
        subscriptionEvents: subEventsRes.data ?? [],
        gmailConnection: gmailRes.data ?? null,
        smtpConnection: smtpRes.data ?? null,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chasehq-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Data exported");
    } catch (e) {
      console.warn("[SettingsScreen] export failed:", e);
      toast.error("We couldn't export everything just now — try again.");
    } finally {
      setExporting(false);
    }
  }

  async function handleDeleteAccount() {
    if (!user) return;
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("delete-account");
      if (error) throw error;
      // Cancel any queued local notifications so they don't fire after the auth row is gone.
      await cancelAllPending();
      // Wipe all user-scoped localStorage so nothing lingers after account deletion.
      clearLocalUserProfile();
      clearDemoUserProfile();
      localStorage.removeItem(STORAGE_KEYS.SCHEDULE_PRESET);
      localStorage.removeItem(STORAGE_KEYS.SCHEDULE_CUSTOM_STEPS);
      localStorage.removeItem(STORAGE_KEYS.ONBOARDING_DONE_SESSION);
      localStorage.removeItem(STORAGE_KEYS.ONBOARDING_STATE);
      localStorage.removeItem("notifications");
      localStorage.removeItem("schedule");
      localStorage.removeItem(displayNamePromptShownKey(user.id));
      localStorage.removeItem(FLOW_STORAGE_KEY);
      navigate("/", { replace: true });
    } catch (e) {
      toast.error("We couldn't finish that just now. Try again in a moment.");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const authMethod = "Google";



  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden pb-24 pt-[env(safe-area-inset-top,0px)] animate-page-enter">
      <div className="px-5 pt-5">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-[clamp(24px,6vw,32px)] font-bold text-foreground tracking-[-0.03em]">Settings</h1>
          <NotificationBell />
        </div>

        {isAuthenticated && (
          <>
            {/* ACCOUNT */}
            <SectionLabel>Account</SectionLabel>
            <div className="bg-card border border-border rounded-2xl p-4 mb-3 shadow-[var(--shadow-card)]">
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10 rounded-xl shrink-0">
                  <AvatarImage src={user?.user_metadata?.avatar_url} className="rounded-xl object-cover" />
                  <AvatarFallback className="rounded-xl bg-accent">
                    <UserIcon className="w-5 h-5 text-primary" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 -mb-0.5">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={handleSaveName}
                      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                      placeholder="Add your name"
                      className="text-sm font-semibold text-foreground bg-transparent focus:outline-none w-full truncate placeholder:text-muted-foreground/50 border-b border-transparent focus:border-primary/40 transition-colors pb-0.5"
                    />
                    {nameSaved && <span className="text-[11px] text-green-600 shrink-0 font-medium">✓ Saved</span>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-1">{user?.email || "—"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Signed in with {authMethod}</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate("/settings/billing")}
              className="w-full bg-card border border-border rounded-2xl p-4 mb-5 flex items-center gap-3 hover:border-primary/40 transition-colors shadow-[var(--shadow-card)]"
            >
              <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shrink-0">
                <CreditCard className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-semibold text-foreground">Billing</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {ent.loading ? "Loading…"
                    : ent.isTrialing ? `Free trial • ${ent.daysLeftInTrial ?? 0} day${ent.daysLeftInTrial === 1 ? "" : "s"} left`
                    : ent.isActive ? `Active • renews ${ent.nextBillingDate?.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) ?? ""}`
                    : ent.isPastDue ? "Payment past due"
                    : ent.status === "canceled" ? "Canceled"
                    : ent.status === "expired" ? "Restart Your Trial"
                    : "Manage subscription"}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </>
        )}


        {/* PREFERENCES */}
        <SectionLabel>Preferences</SectionLabel>
        <div className="flex flex-col gap-3 mb-5">
          <CollapsibleSection
            title="Notifications"
            subtitle="Email alerts and reminders"
            isOpen={openSection === "notifications"}
            onToggle={() => toggleSection("notifications")}
          >
            <NotificationsSection
              notifications={notifications}
              updateNotifications={(n) => {
                const turningOn = !notifications.autoChase && n.autoChase;
                const turningOff = notifications.autoChase && !n.autoChase;
                updateNotifications(n);
                if (turningOn) requestLocalNotificationPermission();
                if (turningOff) cancelAllPending();
              }}
            />
          </CollapsibleSection>

          <CollapsibleSection
            title="Default follow-up schedule"
            subtitle="Applies to new invoices. Edit per-invoice on its detail page."
            isOpen={openSection === "schedule"}
            onToggle={() => toggleSection("schedule")}
          >
            <ScheduleSection />
          </CollapsibleSection>

          <CollapsibleSection
            title="Personalization"
            subtitle="Tunes AI draft register and the default schedule"
            isOpen={openSection === "personalization"}
            onToggle={() => toggleSection("personalization")}
          >
            <PersonalizationSection />
          </CollapsibleSection>
        </div>

        {isAuthenticated && (
          <>
            {/* DATA CONTROLS — collapsible */}
            <SectionLabel>Data controls</SectionLabel>
            <div className="mb-5">
              <CollapsibleSection
                title="Your data"
                subtitle="Export or delete your account data"
                isOpen={openSection === "data"}
                onToggle={() => toggleSection("data")}
              >
                <div className="flex flex-col divide-y divide-border -mx-4 -my-4">
                  <button onClick={handleExport} disabled={exporting} className="flex items-center gap-3 p-4 text-left hover:bg-muted/40 transition-colors disabled:opacity-60">
                    <Download className="w-4 h-4 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">{exporting ? "Exporting…" : "Export my data"}</p>
                      <p className="text-xs text-muted-foreground">Download a JSON copy of your invoices and account info</p>
                    </div>
                  </button>
                  <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-3 p-4 text-left hover:bg-muted/40 transition-colors">
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-destructive">Delete my data</p>
                      <p className="text-xs text-muted-foreground">Permanently remove your invoices, follow-ups, and connections</p>
                    </div>
                  </button>
                </div>
              </CollapsibleSection>
            </div>
          </>
        )}

        {/* HELP */}
        <SectionLabel>Help</SectionLabel>
        <div className="bg-card border border-border rounded-2xl shadow-[var(--shadow-card)] mb-5">
          <button
            onClick={() => flowSend("REPLAY_TOUR")}
            className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/40 transition-colors rounded-2xl"
          >
            <div className="w-9 h-9 rounded-xl bg-accent/60 text-primary flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Replay product tour</p>
              <p className="text-xs text-muted-foreground mt-0.5">Walk through ChaseHQ's key features again</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* LEGAL */}
        <SectionLabel>Legal</SectionLabel>
        <div className="bg-card border border-border rounded-2xl shadow-[var(--shadow-card)] divide-y divide-border mb-5">
          <button onClick={() => navigate("/legal/privacy")} className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/40 transition-colors rounded-t-2xl">
            <div className="w-9 h-9 rounded-xl bg-[hsl(var(--warm-100))] text-orange-700 flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            <p className="flex-1 text-sm font-semibold text-foreground">Privacy Policy</p>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
          <button onClick={() => navigate("/legal/terms")} className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/40 transition-colors rounded-b-2xl">
            <div className="w-9 h-9 rounded-xl bg-accent/60 text-primary flex items-center justify-center shrink-0">
              <ScrollText className="w-4 h-4" />
            </div>
            <p className="flex-1 text-sm font-semibold text-foreground">Terms of Use</p>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {isAuthenticated && (
          <div className="flex items-center justify-center mt-4 mb-4">
            <button onClick={handleSignOut} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        )}
      </div>


      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes your account, invoices, and follow-ups.
              You will not be able to sign back in. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete everything"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
