import { LocalNotifications } from "@capacitor/local-notifications";
import {
  buildNotificationTitle,
  buildNotificationBody,
  computeStepWithEscalation,
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
        const { scheduledFor } = computeStepWithEscalation(invoice, step);
        const fireAt = new Date(scheduledFor);
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
