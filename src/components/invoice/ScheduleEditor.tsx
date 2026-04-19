import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/context/AppContext";
import { DEFAULT_STEPS, computeStepDate, buildNotificationTitle, buildNotificationBody, getUserTimezone, type ScheduleStep } from "@/lib/scheduleDefaults";
import type { Invoice } from "@/lib/data";
import { Calendar, RotateCcw, Pause, Play, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function ScheduleEditor({ invoice }: { invoice: Invoice }) {
  const { user } = useApp();
  const [steps, setSteps] = useState<ScheduleStep[]>(DEFAULT_STEPS);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("followup_schedules")
        .select("steps, paused")
        .eq("invoice_id", invoice.id)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setSteps((data.steps as unknown as ScheduleStep[]) || DEFAULT_STEPS);
        setPaused(data.paused);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [invoice.id]);

  async function persist(nextSteps: ScheduleStep[], nextPaused: boolean) {
    if (!user?.id) return;
    setSaving(true);
    const tz = getUserTimezone();
    // Upsert schedule
    await supabase.from("followup_schedules").upsert(
      { invoice_id: invoice.id, user_id: user.id, steps: nextSteps as unknown as never, timezone: tz, paused: nextPaused },
      { onConflict: "invoice_id" }
    );
    // Cancel all pending notifications and recreate (if not paused)
    await supabase.from("notifications").update({ status: "canceled" }).eq("invoice_id", invoice.id).eq("status", "pending");
    if (!nextPaused) {
      const rows = nextSteps.map((step, idx) => ({
        user_id: user.id,
        invoice_id: invoice.id,
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
    toast.success("Schedule updated");
  }

  function updateOffset(idx: number, value: number) {
    const next = steps.map((s, i) => (i === idx ? { ...s, offset_days: Math.max(0, value) } : s));
    setSteps(next);
  }

  function commitChanges() { persist(steps, paused); }
  function resetDefaults() { setSteps(DEFAULT_STEPS); persist(DEFAULT_STEPS, false); setPaused(false); }
  function togglePaused() { const next = !paused; setPaused(next); persist(steps, next); }

  if (loading) return null;

  return (
    <div className="mt-4 bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Reminder schedule</h3>
          <p className="text-xs text-muted-foreground mt-0.5">We'll ping you on these days. Edit anytime.</p>
        </div>
        <button
          onClick={togglePaused}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            paused ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          {paused ? <><Play className="w-3 h-3" /> Resume</> : <><Pause className="w-3 h-3" /> Pause</>}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {steps.map((step, i) => {
          const iso = computeStepDate(invoice.dueDateISO, step.offset_days);
          const parsed = new Date(iso);
          const date = isNaN(parsed.getTime()) ? new Date() : parsed;
          return (
            <div key={i} className="flex items-center gap-2 p-2.5 bg-muted rounded-xl">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-xs text-muted-foreground">Day</span>
                <input
                  type="number"
                  min={0}
                  value={step.offset_days}
                  onChange={(e) => updateOffset(i, parseInt(e.target.value) || 0)}
                  onBlur={commitChanges}
                  className="w-14 px-2 py-1 text-xs font-bold text-primary bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{step.tone} — {step.type === "due" ? "due reminder" : step.type === "escalation" ? "escalation" : "follow-up"}</p>
                <p className="text-[11px] text-muted-foreground">{format(date, "MMM d, yyyy")}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-3">
        <button
          onClick={resetDefaults}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="w-3 h-3" /> Reset to default
        </button>
        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
      </div>
    </div>
  );
}
