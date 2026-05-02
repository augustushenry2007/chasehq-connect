// Surface schedule steps whose `scheduled_for` is in the past but the user
// hasn't sent the follow-up yet — typically because they were offline when
// the step was due. Used by the Dashboard catch-up banner and CatchupScreen.
//
// A step is "missed" iff:
//   - notifications.status = 'pending' (not yet delivered/sent/canceled)
//   - notifications.scheduled_for < now()
//   - notifications.scheduled_for >= invoices.created_at  (D4e: back-dated
//     invoices' first scheduled step is anchored to created_at, so this
//     filter naturally excludes rows we've already pushed forward)
//
// We query `notifications` directly rather than reconstructing the schedule
// in JS — the notifications row IS the source of truth for "what should
// have fired and didn't."

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/context/AppContext";

export interface MissedStep {
  notificationId: string;
  invoiceId: string;
  invoiceNumber: string;
  client: string;
  amount: number;
  scheduleStepIndex: number;
  type: "due" | "followup" | "escalation";
  scheduledFor: string;
  daysLate: number;
}

export function useMissedSteps() {
  const { user, invoices } = useApp();
  const [missed, setMissed] = useState<MissedStep[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user?.id) {
      setMissed([]);
      setLoading(false);
      return;
    }
    const nowISO = new Date().toISOString();
    const { data } = await supabase
      .from("notifications")
      .select("id, invoice_id, schedule_step_index, type, scheduled_for")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .lt("scheduled_for", nowISO);

    if (!data) {
      setMissed([]);
      setLoading(false);
      return;
    }

    const now = Date.now();
    const byDbId = new Map(invoices.map((i) => [i.dbId, i]));
    const result: MissedStep[] = [];
    for (const row of data) {
      const inv = byDbId.get(row.invoice_id);
      if (!inv) continue;
      if (inv.status === "Paid") continue;
      // Filter out steps that were already in the past at invoice creation —
      // those are back-dated history, not "you missed them while offline."
      const scheduledMs = new Date(row.scheduled_for).getTime();
      const createdMs = new Date(inv.createdAtISO).getTime();
      if (scheduledMs < createdMs) continue;
      result.push({
        notificationId: row.id,
        invoiceId: inv.id,
        invoiceNumber: inv.id,
        client: inv.client,
        amount: inv.amount,
        scheduleStepIndex: row.schedule_step_index,
        type: row.type as MissedStep["type"],
        scheduledFor: row.scheduled_for,
        daysLate: Math.max(0, Math.floor((now - scheduledMs) / 86_400_000)),
      });
    }
    setMissed(result);
    setLoading(false);
  }, [user?.id, invoices]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { missed, loading, refetch };
}
