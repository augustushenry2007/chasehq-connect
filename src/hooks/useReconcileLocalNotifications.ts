import { useCallback, useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/context/AppContext";
import { reconcilePendingLocalNotifications } from "@/lib/localNotifications";

// At most one reconcile per this interval when triggered by app-foreground —
// the OS-purge case (reinstall / iOS notification-storage purge / device
// restore / the ~64-pending cap) only happens after a long background, so
// re-checking on every quick foreground would be wasteful.
const RESUME_DEBOUNCE_MS = 10 * 60_000;

// Re-arm any future pending notification row that the OS isn't currently
// scheduled to fire. OS local notifications are lost to an app reinstall / iOS
// notification purge / device restore even though the DB notification rows, the
// in-app bell, and the email cron all survive — so push silently stops without
// this. Runs once per launch (after auth + invoices are ready) AND again whenever
// the app is foregrounded after the debounce window — because an app left open /
// backgrounded for days would otherwise never re-arm. Idempotent (stable notifIds).
export function useReconcileLocalNotifications(): void {
  const { isAuthenticated, user, invoices, invoicesLoading } = useApp();
  const lastRunRef = useRef(0);
  // The resume listener is registered once; keep it reading the latest invoices.
  const invoicesRef = useRef(invoices);
  invoicesRef.current = invoices;

  const runReconcile = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;
    if (!isAuthenticated || !user?.id) return;
    lastRunRef.current = Date.now();
    const userId = user.id;
    const invoicesNow = invoicesRef.current;

    const nowISO = new Date().toISOString();
    const { data: rows, error } = await supabase
      .from("notifications")
      .select("invoice_id, schedule_step_index, title, body, scheduled_for")
      .eq("user_id", userId)
      .eq("status", "pending")
      .gt("scheduled_for", nowISO)
      .order("scheduled_for", { ascending: true })
      .limit(200);
    if (error || !rows?.length) return;

    // Skip invoices that are paid (the hourly cron hasn't canceled their rows
    // yet) or whose follow-up schedule is paused.
    const paidIds = new Set(invoicesNow.filter((i) => i.status === "Paid").map((i) => i.dbId));
    const candidateInvoiceIds = [...new Set(rows.map((r) => r.invoice_id))].filter((id) => !paidIds.has(id));
    if (!candidateInvoiceIds.length) return;

    const { data: scheds } = await supabase
      .from("followup_schedules")
      .select("invoice_id, paused")
      .in("invoice_id", candidateInvoiceIds);
    const pausedIds = new Set((scheds ?? []).filter((s) => s.paused).map((s) => s.invoice_id));

    const eligible = rows.filter((r) => !paidIds.has(r.invoice_id) && !pausedIds.has(r.invoice_id));
    if (!eligible.length) return;

    await reconcilePendingLocalNotifications(eligible);
  }, [isAuthenticated, user?.id]);

  // Once per launch.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (!isAuthenticated || !user?.id || invoicesLoading) return;
    if (lastRunRef.current === 0) void runReconcile();
  }, [isAuthenticated, user?.id, invoicesLoading, runReconcile]);

  // On every foreground, debounced.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const onResume = () => {
      if (!isAuthenticated || !user?.id) return;
      if (Date.now() - lastRunRef.current < RESUME_DEBOUNCE_MS) return;
      void runReconcile();
    };
    window.addEventListener("chasehq:app-resumed", onResume);
    return () => window.removeEventListener("chasehq:app-resumed", onResume);
  }, [isAuthenticated, user?.id, runReconcile]);
}
