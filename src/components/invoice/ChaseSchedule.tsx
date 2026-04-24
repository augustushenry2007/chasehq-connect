import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/context/AppContext";
import {
  getDefaultSteps,
  computeStepDate,
  buildNotificationTitle,
  buildNotificationBody,
  getUserTimezone,
  PRESET_STEPS,
  type ScheduleStep,
  type SchedulePreset,
} from "@/lib/scheduleDefaults";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import type { Invoice } from "@/lib/data";
import { Check, Loader2, Pause, Play, RotateCcw } from "lucide-react";
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

const TONE_OPTIONS: ScheduleStep["tone"][] = ["Polite", "Friendly", "Firm", "Urgent", "Final Notice"];
const PRESETS: SchedulePreset[] = ["active", "patient", "light"];

const TONE_BADGE: Record<ScheduleStep["tone"], string> = {
  Polite:        "bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400",
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

function matchSentToSteps(steps: ScheduleStep[], sent: SentEntry[]): (SentEntry | null)[] {
  const sorted = [...sent].sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime());
  return steps.map((_, idx) => sorted[idx] ?? null);
}

function StepRow({
  item,
  editMode,
  onOffsetChange,
  onOffsetBlur,
  onToneChange,
}: {
  item: Extract<TimelineItem, { kind: "step" }>;
  editMode: boolean;
  onOffsetChange: (v: number) => void;
  onOffsetBlur: () => void;
  onToneChange: (t: ScheduleStep["tone"]) => void;
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

  const chip = {
    sent:     <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Sent</span>,
    today:    <span className="text-[11px] font-medium text-primary">Today</span>,
    overdue:  <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">Send now</span>,
    upcoming: <span className="text-[11px] text-muted-foreground">In {days} day{days === 1 ? "" : "s"}</span>,
  }[status];

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
            <p className="text-sm font-semibold text-foreground leading-snug">{isValid(date) ? format(date, "MMM d") : "—"}</p>
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
    <div className="relative flex items-center gap-3 py-3">
      <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 z-10 bg-amber-50 border-amber-400 dark:bg-amber-900/30 dark:border-amber-600">
        <span className="text-[8px] font-bold text-amber-600 dark:text-amber-400">DUE</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground leading-snug">{isValid(date) ? format(date, "MMM d") : "—"}</p>
        <p className="text-[11px] text-muted-foreground">Invoice due</p>
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
        <p className="text-sm font-semibold text-foreground leading-snug">{(() => { const d = new Date(entry.sent_at); return isValid(d) ? format(d, "MMM d") : "—"; })()}</p>
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

export default function ChaseSchedule({ invoice, refreshKey = 0 }: { invoice: Invoice; refreshKey?: number }) {
  const { user } = useApp();
  const [steps, setSteps] = useState<ScheduleStep[]>(() => getDefaultSteps());
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

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      supabase.from("followup_schedules").select("steps, paused").eq("invoice_id", invoice.dbId).maybeSingle(),
      supabase.from("followups").select("id, sent_at, tone, subject").eq("invoice_id", invoice.dbId).order("sent_at", { ascending: true }),
    ]).then(([sched, followups]) => {
      if (cancelled) return;
      if (sched.data) {
        setSteps((sched.data.steps as unknown as ScheduleStep[]) || getDefaultSteps());
        setPaused(sched.data.paused);
      }
      setSent(followups.data ?? []);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [invoice.dbId, refreshKey]);

  async function persist(nextSteps: ScheduleStep[], nextPaused: boolean, silent = false) {
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
    setSaving(false);
    if (!silent) toast.success("Your schedule's set.");
  }

  function flashSaved() {
    setSavedIndicator(true);
    setTimeout(() => setSavedIndicator(false), 1500);
  }

  function handlePreset(preset: SchedulePreset) {
    const next = PRESET_STEPS[preset];
    localStorage.setItem(STORAGE_KEYS.SCHEDULE_PRESET, preset);
    setCurrentPreset(preset);
    setSteps(next);
    persist(next, paused, true);
  }

  function updateOffset(idx: number, val: number) {
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, offset_days: Math.max(1, val) } : s)));
  }

  function updateTone(idx: number, tone: ScheduleStep["tone"]) {
    const type: ScheduleStep["type"] = (tone === "Final Notice" || tone === "Urgent") ? "escalation" : "followup"; // Polite, Friendly, Firm all map to followup
    const next = steps.map((s, i) => (i === idx ? { ...s, tone, type } : s));
    setSteps(next);
    persist(next, paused, true);
    flashSaved();
  }

  function togglePaused() {
    const next = !paused;
    setPaused(next);
    persist(steps, next);
  }

  function resetDefaults() {
    const d = getDefaultSteps();
    setSteps(d);
    setPaused(false);
    persist(d, false);
  }

  const { items, dividerAt } = useMemo(() => {
    const matched = matchSentToSteps(steps, sent);
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

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const firstFuture = all.findIndex((it) => {
      const d = new Date(it.date);
      d.setHours(0, 0, 0, 0);
      return d.getTime() >= todayStart.getTime();
    });
    return { items: all, dividerAt: firstFuture > 0 && firstFuture < all.length ? firstFuture : -1 };
  }, [steps, sent, invoice.dueDateISO]);

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
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h3 className="text-sm font-semibold text-foreground">Chase Schedule</h3>
        <div className="flex items-center gap-1">
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
      </div>

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
        {items.flatMap((item, i) => {
          const rows = [];
          if (dividerAt === i) {
            rows.push(
              <div key="today-divider" className="flex items-center gap-3 py-1.5">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Today</span>
                <div className="flex-1 h-px bg-border" />
              </div>,
            );
          }
          if (item.kind === "step") {
            rows.push(
              <StepRow
                key={`s-${item.idx}`}
                item={item}
                editMode={editMode}
                onOffsetChange={(v) => updateOffset(item.idx, v)}
                onOffsetBlur={() => persist(steps, paused)}
                onToneChange={(t) => updateTone(item.idx, t)}
              />,
            );
          } else if (item.kind === "due") {
            rows.push(<DueRow key="due-date" date={item.date} />);
          } else {
            rows.push(<SentRow key={`u-${item.entry.id}`} entry={item.entry} />);
          }
          return rows;
        })}
      </div>

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

      <AlertDialog open={confirmResetOpen} onOpenChange={setConfirmResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore default schedule?</AlertDialogTitle>
            <AlertDialogDescription>
              This replaces your current steps with the Active preset. Any custom timing or tones you've set will be lost.
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
