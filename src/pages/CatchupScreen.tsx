import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useMissedSteps, type MissedStep } from "@/hooks/useMissedSteps";
import { supabase } from "@/integrations/supabase/client";
import { formatUSD } from "@/lib/data";
import { ChevronRight, Loader2 } from "lucide-react";

// Catch-up screen: surfaces every notification whose `scheduled_for` has
// passed but the user never sent the follow-up. Three actions per row:
//   - Send now: navigate to the invoice detail; AIDraftComposer handles the rest.
//   - Skip: cancel the notification (one-time dismiss; no email goes out).
//   - Snooze: push scheduled_for forward 24h and leave it pending.
//
// We deliberately don't auto-send anything from here — that's the whole point
// of the catch-up flow. The user reviews and decides per step.

export default function CatchupScreen() {
  const navigate = useNavigate();
  const { missed, loading, refetch } = useMissedSteps();
  const [busy, setBusy] = useState<string | null>(null);

  async function handleSkip(step: MissedStep) {
    setBusy(step.notificationId);
    const { error } = await supabase
      .from("notifications")
      .update({ status: "canceled" })
      .eq("id", step.notificationId);
    if (error) {
      toast.error("Couldn't skip that one. Try again.");
    } else {
      toast.success("Skipped.");
      await refetch();
    }
    setBusy(null);
  }

  async function handleSnooze(step: MissedStep) {
    setBusy(step.notificationId);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const { error } = await supabase
      .from("notifications")
      .update({ scheduled_for: tomorrow.toISOString() })
      .eq("id", step.notificationId);
    if (error) {
      toast.error("Couldn't snooze that one. Try again.");
    } else {
      toast.success("Snoozed for a day.");
      await refetch();
    }
    setBusy(null);
  }

  function handleSendNow(step: MissedStep) {
    navigate(`/invoice/${step.invoiceNumber}`);
  }

  return (
    <div className="h-screen bg-background overflow-y-auto overscroll-contain">
      <ScreenHeader title="Catch up" fallbackPath="/dashboard" />

      <div className="px-5 pt-2 pb-24">
        <p className="text-sm text-muted-foreground leading-relaxed mb-5">
          These follow-ups were scheduled while you were offline. Review each one and decide what to send.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : missed.length === 0 ? (
          <div className="rounded-xl bg-muted/40 border border-border px-4 py-6 text-center">
            <p className="text-sm font-semibold text-foreground">You're all caught up.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Nothing was scheduled while you were away.
            </p>
            <button
              onClick={() => navigate("/dashboard")}
              className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary"
            >
              Back to dashboard <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <ul className="space-y-3">
            {missed.map((step) => {
              const isBusy = busy === step.notificationId;
              return (
                <li
                  key={step.notificationId}
                  className="rounded-xl bg-card border border-border px-4 py-3.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground capitalize truncate">
                        {step.client}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {step.invoiceNumber} · {formatUSD(step.amount)}
                      </p>
                      <p className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold mt-1">
                        Scheduled {step.daysLate} {step.daysLate === 1 ? "day" : "days"} ago
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => handleSendNow(step)}
                      disabled={isBusy}
                      className="flex-1 bg-primary text-primary-foreground text-xs font-semibold py-2 rounded-lg disabled:opacity-50 active:scale-[0.97] transition-all"
                    >
                      Send now
                    </button>
                    <button
                      onClick={() => handleSnooze(step)}
                      disabled={isBusy}
                      className="px-3 text-xs font-semibold text-foreground bg-muted py-2 rounded-lg disabled:opacity-50 active:scale-[0.97] transition-all"
                    >
                      Snooze
                    </button>
                    <button
                      onClick={() => handleSkip(step)}
                      disabled={isBusy}
                      className="px-3 text-xs font-semibold text-muted-foreground py-2 rounded-lg hover:text-foreground disabled:opacity-50 transition-colors"
                    >
                      Skip
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
