import { LocalNotifications } from "@capacitor/local-notifications";
import {
  buildNotificationTitle,
  buildNotificationBody,
  computeStepDate,
  type ScheduleStep,
} from "./scheduleDefaults";

// Derive a stable positive 32-bit integer ID from (invoiceId, stepIdx).
// Max 4 steps per invoice; collision risk negligible for personal use.
function notifId(invoiceId: string, stepIdx: number): number {
  const hex = invoiceId.replace(/-/g, "").slice(0, 7);
  return ((parseInt(hex, 16) & 0x1FFFFFFF) * 10 + stepIdx) >>> 0;
}

function isPushEnabled(): boolean {
  try {
    const s = localStorage.getItem("notifications");
    if (!s) return true;
    return (JSON.parse(s) as { autoChase?: boolean })?.autoChase !== false;
  } catch {
    return true;
  }
}

export async function requestLocalNotificationPermission(): Promise<boolean> {
  try {
    const { display } = await LocalNotifications.requestPermissions();
    return display === "granted";
  } catch {
    return false;
  }
}

export async function scheduleForInvoice(
  invoiceId: string,
  steps: ScheduleStep[],
  invoice: { dueDateISO: string; createdAtISO: string },
  client: string,
  amount: number,
): Promise<void> {
  if (!isPushEnabled()) return;
  try {
    const { display } = await LocalNotifications.checkPermissions();
    if (display !== "granted") {
      const granted = await requestLocalNotificationPermission();
      if (!granted) return;
    }
    const now = Date.now();
    const notifications = steps
      .map((step, idx) => {
        // Same anchor the DB rows use (computeStepDate in createScheduleForInvoice /
        // ChaseSchedule.persist): due_date + offset_days @ 9am device-local. Keeping
        // these in lockstep means the phone buzzes at the same instant the cron /
        // in-app bell consider the step due.
        const fireAt = new Date(computeStepDate(invoice.dueDateISO, step.offset_days));
        if (fireAt.getTime() <= now) return null;
        return {
          id: notifId(invoiceId, idx),
          title: buildNotificationTitle(step.type, client, amount),
          body: buildNotificationBody(step.type, client),
          schedule: { at: fireAt, allowWhileIdle: true },
          extra: { invoice_id: invoiceId },
        };
      })
      .filter(Boolean) as { id: number; title: string; body: string; schedule: { at: Date; allowWhileIdle: boolean } }[];
    if (notifications.length > 0) {
      await LocalNotifications.schedule({ notifications });
    }
  } catch (e) {
    console.warn("[localNotifications] scheduleForInvoice failed:", e);
  }
}

// iOS keeps at most ~64 pending local notifications. Stay safely under it so we
// never silently drop one — and so the cap is applied nearest-first.
const RECONCILE_CAP = 60;

type ReconcileRow = {
  invoice_id: string;
  schedule_step_index: number;
  title: string;
  body: string;
  scheduled_for: string;
};

/**
 * Re-arm any future notification row (passed in nearest-first) that isn't currently
 * scheduled with the OS. Idempotent — uses the same stable notifId as scheduleForInvoice,
 * so rows already armed are skipped. Used at native launch to repair OS notifications
 * lost to a reinstall / notification purge / device restore (DB rows + in-app bell +
 * email cron all survive that; only the OS schedule doesn't), and to backfill anything
 * an earlier scheduleForInvoice dropped past the iOS limit. Never prompts for permission
 * — a silent background reconcile shouldn't pop a dialog; if undetermined/denied there's
 * nothing armed to reconcile anyway.
 */
export async function reconcilePendingLocalNotifications(rows: ReconcileRow[]): Promise<void> {
  if (!isPushEnabled()) return;
  try {
    const { display } = await LocalNotifications.checkPermissions();
    if (display !== "granted") return;
    const { notifications: pending } = await LocalNotifications.getPending();
    const pendingIds = new Set(pending.map((n) => n.id));
    const slots = Math.max(0, RECONCILE_CAP - pendingIds.size);
    if (slots === 0) return;
    const now = Date.now();
    const toArm: { id: number; title: string; body: string; schedule: { at: Date; allowWhileIdle: boolean }; extra: { invoice_id: string } }[] = [];
    for (const r of rows) {
      if (toArm.length >= slots) break;
      const at = new Date(r.scheduled_for);
      if (isNaN(at.getTime()) || at.getTime() <= now) continue;
      const id = notifId(r.invoice_id, r.schedule_step_index);
      if (pendingIds.has(id)) continue;
      toArm.push({
        id,
        title: r.title,
        body: r.body,
        schedule: { at, allowWhileIdle: true },
        extra: { invoice_id: r.invoice_id },
      });
    }
    if (toArm.length > 0) {
      await LocalNotifications.schedule({ notifications: toArm });
    }
  } catch (e) {
    console.warn("[localNotifications] reconcilePendingLocalNotifications failed:", e);
  }
}

export async function cancelForInvoice(invoiceId: string, stepCount = 4): Promise<void> {
  try {
    const notifications = Array.from({ length: stepCount }, (_, i) => ({ id: notifId(invoiceId, i) }));
    await LocalNotifications.cancel({ notifications });
  } catch (e) {
    console.warn("[localNotifications] cancelForInvoice failed:", e);
  }
}

export function attachNotificationTapHandler(): void {
  LocalNotifications.addListener("localNotificationActionPerformed", ({ notification }) => {
    const invoiceId = (notification.extra as { invoice_id?: string } | undefined)?.invoice_id;
    if (invoiceId) {
      window.history.pushState({}, "", `/invoice/${invoiceId}`);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  });
}

export async function cancelAllPending(): Promise<void> {
  try {
    const { notifications } = await LocalNotifications.getPending();
    if (notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: notifications.map((n) => ({ id: n.id })) });
    }
  } catch (e) {
    console.warn("[localNotifications] cancelAllPending failed:", e);
  }
}
