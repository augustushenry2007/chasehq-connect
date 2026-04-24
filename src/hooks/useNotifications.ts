import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/context/AppContext";
import {
  DEFAULT_STEPS,
  computeStepDate,
  buildNotificationTitle,
  buildNotificationBody,
  getUserTimezone,
  type ScheduleStep,
} from "@/lib/scheduleDefaults";

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
      supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .order("scheduled_for", { ascending: true })
        .limit(10),
    ]);
    setNotifications((recentRes.data as NotificationRow[]) || []);
    setUpcoming((upcomingRes.data as NotificationRow[]) || []);
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
 * Create the default schedule + notification rows for a freshly created invoice.
 * Best-effort: fails silently so invoice creation isn't blocked.
 */
export async function createScheduleForInvoice(
  userId: string,
  invoice: { id: string; client: string; amount: number; due_date: string },
  steps: ScheduleStep[] = DEFAULT_STEPS
): Promise<void> {
  try {
    const tz = getUserTimezone();
    await supabase.from("followup_schedules").insert({
      invoice_id: invoice.id,
      user_id: userId,
      steps: steps as unknown as never,
      timezone: tz,
    });
    const rows = steps.map((step, idx) => ({
      user_id: userId,
      invoice_id: invoice.id,
      schedule_step_index: idx,
      type: step.type,
      title: buildNotificationTitle(step.type, invoice.client, invoice.amount),
      body: buildNotificationBody(step.type, invoice.client),
      scheduled_for: computeStepDate(invoice.due_date, step.offset_days),
      status: "pending" as const,
    }));
    if (rows.length) await supabase.from("notifications").insert(rows);
  } catch (e) {
    console.warn("Failed to create notification schedule:", e);
  }
}

/**
 * Mark the next pending step as sent (called after a successful Send).
 */
export async function advanceScheduleAfterSend(invoiceId: string): Promise<void> {
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
  } catch (e) {
    console.warn("advanceScheduleAfterSend failed:", e);
  }
}
