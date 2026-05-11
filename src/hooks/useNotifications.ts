import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/context/AppContext";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import {
  buildScheduleForLateness,
  getDefaultScheduleForInvoice,
  computeStepDate,
  buildNotificationTitle,
  buildNotificationBody,
  getUserTimezone,
  type ScheduleStep,
  type SchedulePreset,
} from "@/lib/scheduleDefaults";
import { scheduleForInvoice, cancelForInvoice } from "@/lib/localNotifications";
import { analytics } from "@/integrations/analytics";

export type NotificationRow = {
  id: string;
  user_id: string;
  invoice_id: string;
  schedule_step_index: number;
  type: "due" | "followup" | "escalation";
  title: string;
  body: string;
  scheduled_for: string;
  status: "pending" | "delivered" | "read" | "canceled" | "failed";
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
};

function showBrowserNotification(title: string, body: string) {
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    new Notification(title, { body });
  }
}

export function useNotifications() {
  const { user, isAuthenticated } = useApp();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [upcoming, setUpcoming] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user?.id) {
      setNotifications([]);
      setUpcoming([]);
      setLoading(false);
      return;
    }
    const [recentRes, upcomingRes] = await Promise.all([
      supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["delivered", "read"])
        .order("scheduled_for", { ascending: false })
        .limit(50),
      (() => {
        const horizon = new Date();
        horizon.setDate(horizon.getDate() + 7);
        return supabase
          .from("notifications")
          .select("*")
          .eq("user_id", user.id)
          .eq("status", "pending")
          .lte("scheduled_for", horizon.toISOString())
          .order("scheduled_for", { ascending: true })
          .limit(50);
      })(),
    ]);
    setNotifications((recentRes.data as NotificationRow[]) || []);
    const seen = new Set<string>();
    const deduped: NotificationRow[] = [];
    for (const n of (upcomingRes.data as NotificationRow[]) || []) {
      if (!seen.has(n.invoice_id)) { seen.add(n.invoice_id); deduped.push(n); }
    }
    setUpcoming(deduped);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    refetch();
    if (!user?.id) return;
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.eventType === "UPDATE" && (payload.new as any)?.status === "delivered") {
            showBrowserNotification((payload.new as any).title, (payload.new as any).body);
          }
          refetch();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, user?.id, refetch]);

  const unreadCount = notifications.filter((n) => n.status === "delivered").length;

  async function markRead(id: string) {
    await supabase.from("notifications").update({ status: "read", read_at: new Date().toISOString() }).eq("id", id);
  }

  async function markAllRead() {
    if (!user?.id) return;
    await supabase
      .from("notifications")
      .update({ status: "read", read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("status", "delivered");
  }

  return { notifications, upcoming, loading, unreadCount, markRead, markAllRead, refetch };
}

/**
 * Create (or re-create) the default schedule + notification rows for an invoice.
 * Best-effort: fails silently so invoice creation isn't blocked.
 *
 * Replace-not-append: any pre-existing schedule / pending notifications for this
 * invoice are cleared first, so calling this twice for the same invoice (e.g. an
 * invoice-create retry) doesn't leave orphan pending rows that the cron would
 * double-deliver, and doesn't silently fail on the UNIQUE(invoice_id,
 * schedule_step_index, type) constraint.
 *
 * Uses buildScheduleForLateness so back-dated invoices get a sensibly-bucketed
 * schedule rather than duplicate Final Notice steps from the old tone-floor logic.
 */
export async function createScheduleForInvoice(
  userId: string,
  invoice: { id: string; client: string; amount: number; due_date: string; created_at?: string },
  preset?: SchedulePreset,
): Promise<boolean> {
  try {
    const tz = getUserTimezone();
    const chosenPreset = preset ?? ((localStorage.getItem(STORAGE_KEYS.SCHEDULE_PRESET) ?? "active") as SchedulePreset);
    const effectiveSteps = preset
      ? buildScheduleForLateness(invoice.due_date, new Date().toISOString(), chosenPreset)
      : getDefaultScheduleForInvoice(invoice.due_date, new Date().toISOString());

    // Clear any prior pending notifications + OS notifications for this invoice
    // before re-creating, so a re-run replaces rather than appends.
    await supabase.from("notifications").delete().eq("invoice_id", invoice.id).eq("status", "pending");
    await cancelForInvoice(invoice.id, Math.max(8, effectiveSteps.length));

    await supabase.from("followup_schedules").upsert({
      invoice_id: invoice.id,
      user_id: userId,
      steps: effectiveSteps as unknown as never,
      timezone: tz,
    }, { onConflict: "invoice_id" });

    const rows = effectiveSteps.map((step, idx) => ({
      user_id: userId,
      invoice_id: invoice.id,
      schedule_step_index: idx,
      type: step.type,
      title: buildNotificationTitle(step.type, invoice.client, invoice.amount, step.tone),
      body: buildNotificationBody(step.type, invoice.client),
      scheduled_for: computeStepDate(invoice.due_date, step.offset_days),
      status: "pending" as const,
    }));
    if (rows.length) await supabase.from("notifications").insert(rows);

    const anchorInvoice = {
      dueDateISO: invoice.due_date,
      createdAtISO: invoice.created_at ?? new Date().toISOString(),
    };
    await scheduleForInvoice(invoice.id, effectiveSteps, anchorInvoice, invoice.client, invoice.amount);
    return true;
  } catch (e) {
    // The invoice exists but has no follow-up schedule / notifications. Surface it
    // so the failure is visible — useBackfillMissingSchedules will retry on next
    // launch, and ChaseSchedule self-heals if the user opens the detail screen.
    analytics.error("schedule_creation_failed", e instanceof Error ? e.message : String(e), { invoiceId: invoice.id });
    console.warn("Failed to create notification schedule:", e);
    return false;
  }
}

type ReflowInvoice = { id: string; client: string; amount: number; due_date: string; created_at: string };

// Invoices the "apply my default to existing invoices" action will touch: unpaid,
// schedule not paused, and not yet started chasing (zero delivered/read notification
// rows). Restricting to not-yet-started invoices also keeps createScheduleForInvoice's
// delete-pending-then-reinsert-from-index-0 safe — no UNIQUE(invoice_id,
// schedule_step_index, type) clash against already-delivered rows.
async function getReflowEligibleInvoices(userId: string): Promise<ReflowInvoice[]> {
  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("id, client, amount, due_date, created_at, status")
    .eq("user_id", userId)
    .neq("status", "Paid");
  if (error || !invoices?.length) return [];
  const invoiceIds = invoices.map((i) => i.id);
  const [{ data: scheds }, { data: started }] = await Promise.all([
    supabase.from("followup_schedules").select("invoice_id, paused").in("invoice_id", invoiceIds),
    supabase.from("notifications").select("invoice_id").in("invoice_id", invoiceIds).in("status", ["delivered", "read"]),
  ]);
  const pausedIds = new Set((scheds ?? []).filter((s) => s.paused).map((s) => s.invoice_id));
  const startedIds = new Set((started ?? []).map((r) => r.invoice_id));
  return invoices
    .filter((i) => !pausedIds.has(i.id) && !startedIds.has(i.id))
    .map((i) => ({ id: i.id, client: i.client, amount: Number(i.amount), due_date: i.due_date, created_at: i.created_at }));
}

export async function countReflowEligibleInvoices(userId: string): Promise<number> {
  return (await getReflowEligibleInvoices(userId)).length;
}

/**
 * Re-apply the user's current default follow-up schedule (preset or custom steps in
 * localStorage) to every eligible existing invoice — recomputing followup_schedules,
 * the pending notification rows, and the armed OS notifications. No preset arg is
 * passed to createScheduleForInvoice on purpose, so it honors SCHEDULE_CUSTOM_STEPS
 * if set, exactly as new-invoice creation does.
 */
export async function reflowDefaultScheduleToInvoices(userId: string): Promise<{ updated: number }> {
  const eligible = await getReflowEligibleInvoices(userId);
  for (const inv of eligible) {
    await createScheduleForInvoice(userId, inv);
  }
  return { updated: eligible.length };
}

/**
 * Mark the next pending step as sent (called after a successful Send).
 * If sentTone is "Final Notice", also cancels all remaining pending steps —
 * Final Notice is terminal; no automated steps should follow it.
 */
export async function advanceScheduleAfterSend(invoiceId: string, sentTone?: string): Promise<void> {
  try {
    const { data: pending } = await supabase
      .from("notifications")
      .select("id, schedule_step_index")
      .eq("invoice_id", invoiceId)
      .eq("status", "pending")
      .order("scheduled_for", { ascending: true })
      .limit(1);
    if (pending && pending.length > 0) {
      await supabase.from("notifications").update({ status: "delivered", delivered_at: new Date().toISOString() }).eq("id", pending[0].id);
    }
    if (sentTone === "Final Notice") {
      await supabase
        .from("notifications")
        .update({ status: "canceled" })
        .eq("invoice_id", invoiceId)
        .eq("status", "pending");
    }
  } catch (e) {
    console.warn("advanceScheduleAfterSend failed:", e);
  }
}
