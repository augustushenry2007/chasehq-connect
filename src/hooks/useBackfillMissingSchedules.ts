import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/context/AppContext";
import { createScheduleForInvoice } from "@/hooks/useNotifications";

// Once per launch, after auth + invoices are ready: any unpaid invoice with no
// `followup_schedules` row never got a follow-up schedule (a network blip during
// invoice creation — createScheduleForInvoice swallows its own errors). The cron,
// the in-app bell, and the OS notifications all rely on those rows existing, so
// without this backfill that invoice silently chases nobody, forever. The detail
// screen's ChaseSchedule self-heals the same gap — but only if the user opens it.
//
// Uses createScheduleForInvoice with no `preset` arg so it honors the user's
// custom steps / preset exactly as new-invoice creation does. Idempotent: the
// function clears any prior pending rows for the invoice before re-creating.
export function useBackfillMissingSchedules(): void {
  const { isAuthenticated, user, invoices, invoicesLoading } = useApp();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    if (!isAuthenticated || !user?.id || invoicesLoading) return;
    ranRef.current = true;

    let cancelled = false;
    const userId = user.id;
    (async () => {
      const unpaid = invoices.filter((i) => i.status !== "Paid");
      if (!unpaid.length) return;

      const { data: scheds, error } = await supabase
        .from("followup_schedules")
        .select("invoice_id")
        .eq("user_id", userId);
      if (cancelled || error) return;
      const haveSchedule = new Set((scheds ?? []).map((s) => s.invoice_id));

      const missing = unpaid.filter((i) => !haveSchedule.has(i.dbId));
      for (const inv of missing) {
        if (cancelled) return;
        await createScheduleForInvoice(userId, {
          id: inv.dbId,
          client: inv.client,
          amount: inv.amount,
          due_date: inv.dueDateISO,
          created_at: inv.createdAtISO,
        });
      }
    })();

    return () => { cancelled = true; };
  }, [isAuthenticated, user?.id, invoicesLoading, invoices]);
}
