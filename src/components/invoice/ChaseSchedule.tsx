import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/context/AppContext";
import { CoachHint } from "@/components/onboarding/CoachHint";
import {
  buildScheduleForLateness,
  computeStepDate,
  buildNotificationTitle,
  buildNotificationBody,
  getUserTimezone,
  PRESET_STEPS,
  type ScheduleStep,
  type SchedulePreset,
} from "@/lib/scheduleDefaults";
import { scheduleForInvoice, cancelForInvoice } from "@/lib/localNotifications";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import type { Invoice } from "@/lib/data";
import { Check, ChevronDown, Loader2, Pause, Play, RotateCcw } from "lucide-react";
import { format, isValid } from "date-fns";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SentEntry {
  id: string;
  sent_at: string;
  tone: string | null;
  subject: string | null;
}

type StepStatus = "sent" | "today" | "overdue" | "upcoming";

type TimelineItem =
  | { kind: "step"; idx: number; step: ScheduleStep; date: Date; status: StepStatus; sentEntry: SentEntry | null }
  | { kind: "sent"; date: Date; entry: SentEntry }
  | { kind: "due"; date: Date };

const TONE_OPTIONS: ScheduleStep["tone"][] = ["Friendly", "Firm", "Urgent", "Final Notice"];
const PRESETS: SchedulePreset[] = ["active", "patient", "light"];

const TONE_BADGE: Record<ScheduleStep["tone"], string> = {
  Friendly:      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  Firm:          "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  Urgent:        "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  "Final Notice":"bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
};

function getStepStatus(dateISO: string, isSent: boolean): StepStatus {
  if (isSent) return "sent";
  const d = new Date(dateISO);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = d.getTime() - today.getTime();
  if (diff === 0) return "today";
  if (diff < 0) return "overdue";
  return "upcoming";
}

function daysFromToday(date: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

function matchSentToSteps(steps: ScheduleStep[], sent: SentEntry[], dueDateISO: string): (SentEntry | null)[] {
  const sorted = [...sent].sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime());
  const used = new Set<number>();
  return steps.map((step) => {
    const stepMs = new Date(computeStepDate(dueDateISO, step.offset_days)).getTime();
    const windowStart = stepMs - 86_400_000; // 1-day tolerance: catches same-day or 1-day-early sends
    const idx = sorted.findIndex(
      (s, i) => !used.has(i) && new Date(s.sent_at).getTime() >= windowStart,
    );
    if (idx === -1) return null;
    used.add(idx);
    return sorted[idx];
  });
}

function StepRow({
  item,
  editMode,
  onOffsetChange,
  onOffsetBlur,
  onToneChange,
  isActionable = false,
  paused = false,
  onSendNow,
}: {
  item: Extract<TimelineItem, { kind: "step" }>;
  editMode: boolean;
  onOffsetChange: (v: number) => void;
  onOffsetBlur: () => void;
  onToneChange: (t: ScheduleStep["tone"]) => void;
  isActionable?: boolean;
  paused?: boolean;
  onSendNow?: () => void;
}) {
  const { step, date, status } = item;
  const typeLabel = step.type === "due" ? "due reminder" : step.type === "escalation" ? "escalation" : "follow-up";
  const days = daysFromToday(date);

  const dotClass = {
    sent:     "bg-emerald-500 border-emerald-500 text-white",
    today:    "bg-primary border-primary text-primary-foreground",
    overdue:  "bg-amber-500 border-amber-500 text-white",
    upcoming: "bg-card border-border",
  }[status];

  const chip = (() => {
    if (status === "sent") return <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Sent</span>;
    if (isActionable && (status === "today" || status === "overdue") && !paused && onSendNow) {
      return (
        <button
          onClick={onSendNow}
          className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98] transition"
        >
          Send now
        </button>
      );
    }
    if (status === "today") return <span className="text-[11px] font-medium text-primary">Today</span>;
    if (status === "overdue") return <span className="text-[11px] text-muted-foreground">Overdue</span>;
    return <span className="text-[11px] text-muted-foreground">In {days} day{days === 1 ? "" : "s"}</span>;
  })();

  return (
    <div className="relative flex items-center gap-3 py-3">
      {/* Dot — sits on top of the continuous line */}
      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 z-10 ${dotClass}`}>
        {status === "sent" && <Check className="w-3 h-3" strokeWidth={3} />}
      </div>

      <div className="flex-1 min-w-0">
        {editMode && status !== "sent" ? (
          <div className="flex items-center gap-1.5 flex-wrap">
            <select
              value={step.tone}
              onChange={(e) => onToneChange(e.target.value as ScheduleStep["tone"])}
              className="text-xs font-medium bg-muted border border-border rounded-md px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
            >
              {TONE_OPTIONS.map((t) => <option key={t}>{t}</option>)}
            </select>
            <span className="text-xs text-muted-foreground">+</span>
            <input
              type="number"
              min={1}
              value={step.offset_days}
              onChange={(e) => onOffsetChange(Math.max(1, parseInt(e.target.value) || 1))}
              onBlur={onOffsetBlur}
              className="w-14 px-2 py-1 text-xs font-bold text-primary bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <span className="text-xs text-muted-foreground">days after due</span>
          </div>
        ) : (
          <div>
            <p className="text-sm font-semibold text-foreground leading-snug">{isValid(date) ? format(date, "MMM d, yyyy") : "—"}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${TONE_BADGE[step.tone] ?? ""}`}>
                {step.tone}
              </span>
              <span className="text-[11px] text-muted-foreground">{typeLabel}</span>
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0">{chip}</div>
    </div>
  );
}

function DueRow({ date }: { date: Date }) {
  return (
    <div className="relative flex items-stretch gap-3 py-1.5">
      <div className="w-6 flex items-center justify-center shrink-0 z-10">
        <div className="w-6 h-6 rounded-full bg-amber-400 dark:bg-amber-500 flex items-center justify-center shadow-sm ring-4 ring-background">
          <span className="text-[8px] font-extrabold text-white tracking-wider">DUE</span>
        </div>
      </div>
      <div className="flex-1 min-w-0 rounded-xl bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 px-3.5 py-2.5 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-amber-900 dark:text-amber-100 leading-tight">
            {isValid(date) ? format(date, "MMM d, yyyy") : "—"}
          </p>
          <p className="text-[11px] font-medium text-amber-700 dark:text-amber-300 mt-0.5">
            Invoice due
          </p>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 dark:text-amber-100 bg-amber-200 dark:bg-amber-800 px-2 py-0.5 rounded-full shrink-0">
          Due Date
        </span>
      </div>
    </div>
  );
}

function SentRow({ entry }: { entry: SentEntry }) {
  const tone = entry.tone as ScheduleStep["tone"] | null;
  return (
    <div className="relative flex items-center gap-3 py-3">
      <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 z-10 bg-emerald-500 border-emerald-500 text-white">
        <Check className="w-3 h-3" strokeWidth={3} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground leading-snug">{(() => { const d = new Date(entry.sent_at); return isValid(d) ? format(d, "MMM d, yyyy") : "—"; })()}</p>
        {tone && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${TONE_BADGE[tone] ?? "bg-muted text-muted-foreground"}`}>
            {tone}
          </span>
        )}
      </div>
      <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 shrink-0">Sent</span>
    </div>
  );
}

export default function ChaseSchedule({
  invoice,
  refreshKey = 0,
  onSendNow,
}: {
  invoice: Invoice;
  refreshKey?: number;
  onSendNow?: (tone: ScheduleStep["tone"]) => void;
}) {
  const { user } = useApp();
  const [steps, setSteps] = useState<ScheduleStep[]>([]);
  const [paused, setPaused] = useState(false);
  const [sent, setSent] = useState<SentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [savedIndicator, setSavedIndicator] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [currentPreset, setCurrentPreset] = useState<SchedulePreset>(
    () => (localStorage.getItem(STORAGE_KEYS.SCHEDULE_PRESET) ?? "active") as SchedulePreset,
  );
  const [scheduleOpen, setScheduleOpen] = useState(true);
  const [presetOverrideNote, setPresetOverrideNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      supabase.from("followup_schedules").select("steps, paused").eq("invoice_id", invoice.dbId).maybeSingle(),
      supabase.from("followups").select("id, sent_at, tone, subject").eq("invoice_id", invoice.dbId).order("sent_at", { ascending: true }),
    ]).then(([sched, followups]) => {
      if (cancelled) return;
      if (sched.data) {
        const stored = (sched.data.steps as unknown as ScheduleStep[]);
        setSteps(stored?.length ? stored : buildScheduleForLateness(invoice.dueDateISO, new Date().toISOString(), currentPreset));
        setPaused(sched.data.paused);
      } else {
        setSteps(buildScheduleForLateness(invoice.dueDateISO, new Date().toISOString(), currentPreset));
      }
      setSent(followups.data ?? []);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [invoice.dbId, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  async function persist(nextSteps: ScheduleStep[], nextPaused: boolean, silent = false, message?: string) {
    if (!user?.id) return;
    setSaving(true);
    await supabase.from("followup_schedules").upsert(
      { invoice_id: invoice.dbId, user_id: user.id, steps: nextSteps as unknown as never, timezone: getUserTimezone(), paused: nextPaused },
      { onConflict: "invoice_id" },
    );
    await supabase.from("notifications").update({ status: "canceled" }).eq("invoice_id", invoice.dbId).eq("status", "pending");
    if (!nextPaused) {
      const rows = nextSteps.map((step, idx) => ({
        user_id: user.id!,
        invoice_id: invoice.dbId,
        schedule_step_index: idx,
        type: step.type,
        title: buildNotificationTitle(step.type, invoice.client, invoice.amount),
        body: buildNotificationBody(step.type, invoice.client),
        scheduled_for: computeStepDate(invoice.dueDateISO, step.offset_days),
        status: "pending" as const,
      }));
      if (rows.length) await supabase.from("notifications").insert(rows);
    }
    const anchorInvoice = { dueDateISO: invoice.dueDateISO, createdAtISO: invoice.createdAtISO };
    await cancelForInvoice(invoice.dbId);
    if (!nextPaused) {
      await scheduleForInvoice(invoice.dbId, nextSteps, anchorInvoice, invoice.client, invoice.amount);
    }
    setSaving(false);
    if (!silent) toast.success(message ?? "Schedule saved.");
  }

  function flashSaved() {
    setSavedIndicator(true);
    setTimeout(() => setSavedIndicator(false), 1500);
  }

  function handlePreset(preset: SchedulePreset) {
    const next = buildScheduleForLateness(invoice.dueDateISO, new Date().toISOString(), preset);
    localStorage.setItem(STORAGE_KEYS.SCHEDULE_PRESET, preset);
    setCurrentPreset(preset);
    setSteps(next);
    persist(next, paused, true);
    const dueMs = new Date(`${invoice.dueDateISO.slice(0, 10)}T09:00:00`).getTime();
    const daysLate = Math.max(0, Math.floor((Date.now() - dueMs) / 86_400_000));
    if (daysLate >= 7) {
      const label = preset.charAt(0).toUpperCase() + preset.slice(1);
      setPresetOverrideNote(`${label} preset adjusted — this invoice is ${daysLate} day${daysLate === 1 ? "" : "s"} overdue.`);
      setTimeout(() => setPresetOverrideNote(null), 4000);
    } else {
      setPresetOverrideNote(null);
    }
  }

  function updateOffset(idx: number, val: number) {
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, offset_days: Math.max(1, val) } : s)));
  }

  function updateTone(idx: number, tone: ScheduleStep["tone"]) {
    const type: ScheduleStep["type"] = (tone === "Final Notice" || tone === "Urgent") ? "escalation" : "followup"; // Friendly, Firm all map to followup
    const next = steps.map((s, i) => (i === idx ? { ...s, tone, type } : s));
    setSteps(next);
    persist(next, paused, true);
    flashSaved();
  }

  function togglePaused() {
    const next = !paused;
    setPaused(next);
    if (!next) {
      const rebucketed = buildScheduleForLateness(invoice.dueDateISO, new Date().toISOString(), currentPreset);
      setSteps(rebucketed);
      persist(rebucketed, false, false, "You're back on track — reminders are back on.");
    } else {
      persist(steps, true, false, "Follow-ups paused. You're in control.");
    }
  }

  function resetDefaults() {
    const d = buildScheduleForLateness(invoice.dueDateISO, new Date().toISOString(), currentPreset);
    setSteps(d);
    setPaused(false);
    persist(d, false);
  }

  const { items, actionableStepIdx, collapsedIdxSet } = useMemo(() => {
    const matched = matchSentToSteps(steps, sent, invoice.dueDateISO);
    const usedIds = new Set(matched.filter(Boolean).map((e) => e!.id));

    const stepItems: TimelineItem[] = steps.map((step, idx) => {
      const scheduledISO = computeStepDate(invoice.dueDateISO, step.offset_days);
      const sentEntry = matched[idx];
      const raw = sentEntry ? new Date(sentEntry.sent_at) : new Date(scheduledISO);
      const displayDate = isValid(raw) ? raw : new Date();
      return { kind: "step", idx, step, date: displayDate, status: getStepStatus(scheduledISO, !!sentEntry), sentEntry };
    });

    const unmatchedItems: TimelineItem[] = sent
      .filter((s) => !usedIds.has(s.id))
      .map((entry) => ({ kind: "sent", date: new Date(entry.sent_at), entry }));

    const dueDate = new Date(invoice.dueDateISO);
    const dueItems: TimelineItem[] = isValid(dueDate) ? [{ kind: "due", date: dueDate }] : [];
    const all = [...stepItems, ...unmatchedItems, ...dueItems]
      .filter((it) => isValid(it.date))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    let actionableStepIdx = -1;
    const collapsedIdxSet = new Set<number>();
    for (const it of all) {
      if (it.kind === "step" && (it.status === "today" || it.status === "overdue") && !it.sentEntry) {
        if (actionableStepIdx === -1) {
          actionableStepIdx = it.idx;
        } else {
          collapsedIdxSet.add(it.idx);
        }
      }
    }

    return { items: all, actionableStepIdx, collapsedIdxSet };
  }, [steps, sent, invoice.dueDateISO]);

  const scheduleComplete = useMemo(
    () => steps.length > 0 && items
      .filter((it): it is Extract<TimelineItem, { kind: "step" }> => it.kind === "step")
      .every((it) => it.status === "sent"),
    [items, steps.length],
  );

  if (loading) {
    return (
      <div className="mt-4 bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="h-4 w-28 bg-muted rounded animate-pulse" />
          <div className="h-6 w-40 bg-muted rounded-full animate-pulse" />
        </div>
        <div className="px-4 pb-4 pt-2 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                <div className="h-3 w-40 bg-muted rounded animate-pulse" />
              </div>
              <div className="h-3 w-16 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 bg-card border border-border rounded-2xl overflow-hidden">
      {/* Collapsible header */}
      <CoachHint
        hintKey="chase_schedule"
        side="top"
        title="Chase Schedule"
        body="This is the timeline of follow-up messages for this invoice. Tap to expand and customize when each reminder goes out."
      >
        <button
          onClick={() => setScheduleOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3"
        >
          <span className="text-sm font-semibold text-foreground">Chase Schedule</span>
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${scheduleOpen ? "rotate-180" : ""}`}
          />
        </button>
      </CoachHint>

      {scheduleOpen && (
      <div className="border-t border-border">
      {/* Preset row */}
        <div className="flex items-center justify-end gap-1 px-4 pt-3 pb-1">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => handlePreset(p)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium capitalize transition-colors ${
                currentPreset === p
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>

      {/* Preset override note — shown when bucket overrode the selected preset */}
      {presetOverrideNote && (
        <div className="mx-4 mb-2 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50">
          <p className="text-xs text-blue-800 dark:text-blue-200">{presetOverrideNote}</p>
        </div>
      )}

      {/* Edit-mode lock warning — shown when any steps have already been sent */}
      {editMode && sent.length > 0 && (
        <div className="mx-4 mb-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
          <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
            Steps that already sent are locked — they reflect what was actually delivered. Only upcoming steps can be edited.
          </p>
        </div>
      )}

      {/* Timeline */}
      <div className={`relative px-4 transition-opacity ${paused ? "opacity-50" : ""}`}>
        {/* Continuous left-edge flow line */}
        {items.length > 1 && (
          <span className="absolute left-[28px] top-6 bottom-6 w-px bg-border" aria-hidden="true" />
        )}
        {(() => {
          const renderedRows: React.ReactNode[] = [];
          // Render in reverse-chronological order (latest at top, closest upcoming at bottom).
          let skippedLineShown = false;
          [...items].reverse().forEach((item) => {
            if (item.kind === "step") {
              if (collapsedIdxSet.has(item.idx)) return;
              renderedRows.push(
                <StepRow
                  key={`s-${item.idx}`}
                  item={item}
                  editMode={editMode}
                  onOffsetChange={(v) => updateOffset(item.idx, v)}
                  onOffsetBlur={() => persist(steps, paused)}
                  onToneChange={(t) => updateTone(item.idx, t)}
                  isActionable={item.idx === actionableStepIdx}
                  paused={paused}
                  onSendNow={onSendNow ? () => onSendNow(item.step.tone) : undefined}
                />,
              );
              // "N skipped" note sits below the actionable step in the reversed view
              if (item.idx === actionableStepIdx && collapsedIdxSet.size > 0 && !skippedLineShown) {
                skippedLineShown = true;
                renderedRows.push(
                  <div key="collapsed-skipped" className="flex items-center gap-2 py-1.5 pl-9">
                    <span className="text-[11px] text-muted-foreground">
                      {collapsedIdxSet.size} earlier reminder{collapsedIdxSet.size === 1 ? "" : "s"} skipped — your next send catches them up
                    </span>
                  </div>,
                );
              }
            } else if (item.kind === "due") {
              renderedRows.push(<DueRow key="due-date" date={item.date} />);
            } else {
              renderedRows.push(<SentRow key={`u-${item.entry.id}`} entry={item.entry} />);
            }
          });
          return renderedRows;
        })()}
      </div>

      {/* Schedule complete note */}
      {scheduleComplete && !paused && (
        <div className="mx-4 mb-3 px-3 py-2 rounded-xl bg-muted/50 border border-border">
          <p className="text-xs text-muted-foreground text-center">Schedule complete — manual sends only from here.</p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border mt-1">
        <div className="flex items-center gap-3">
            <button
              onClick={() => setEditMode((e) => !e)}
              className="text-xs font-medium text-primary hover:opacity-80"
            >
              {editMode ? "Done editing" : "Edit timing"}
            </button>
          {editMode && (
            <>
              {savedIndicator && (
                <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 animate-in fade-in duration-150">
                  <Check className="w-3 h-3" /> Saved
                </span>
              )}
              <button
                onClick={() => setConfirmResetOpen(true)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="w-3 h-3" /> Restore defaults
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
            <button
              onClick={togglePaused}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                paused ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {paused ? <><Play className="w-3 h-3" /> Resume</> : <><Pause className="w-3 h-3" /> Pause auto follow-ups</>}
            </button>
        </div>
      </div>
      </div>
      )}

      <AlertDialog open={confirmResetOpen} onOpenChange={setConfirmResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore default schedule?</AlertDialogTitle>
            <AlertDialogDescription>
              This replaces your current steps with the {currentPreset.charAt(0).toUpperCase() + currentPreset.slice(1)} preset, adjusted for current lateness. Any custom timing or tones will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my edits</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmResetOpen(false); resetDefaults(); }}>
              Restore defaults
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
