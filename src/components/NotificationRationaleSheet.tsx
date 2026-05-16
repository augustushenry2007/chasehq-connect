import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Bell } from "lucide-react";
import { requestLocalNotificationPermission } from "@/lib/localNotifications";

const STORAGE_KEY = "chasehq_notif_rationale_shown_v1";

// App Review Guideline 5.1.1(i) requires an in-app rationale before the OS
// permission prompt. Surfacing this only when the user has at least one invoice
// keeps the moment meaningful — they've used ChaseHQ enough to care whether
// reminders fire. Once shown, we never re-show (regardless of accept/deny):
// repeat prompts feel like nagging and accept rate doesn't improve.
export default function NotificationRationaleSheet({ hasAnyInvoice }: { hasAnyInvoice: boolean }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (!hasAnyInvoice) return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    let cancelled = false;
    (async () => {
      try {
        const { display } = await LocalNotifications.checkPermissions();
        if (cancelled) return;
        // Only prompt when iOS hasn't been asked yet.
        if (display === "prompt" || display === "prompt-with-rationale") {
          setOpen(true);
        }
      } catch {
        // Permission check errored — don't gate-keep on a broken plugin call.
      }
    })();
    return () => { cancelled = true; };
  }, [hasAnyInvoice]);

  function dismiss(persist = true) {
    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* private mode */ }
    }
    setOpen(false);
  }

  async function handleTurnOn() {
    setSubmitting(true);
    try {
      await requestLocalNotificationPermission();
    } finally {
      setSubmitting(false);
      dismiss(true);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
      onClick={() => dismiss(true)}
      role="presentation"
    >
      <div
        className="w-full max-w-md bg-card text-card-foreground rounded-t-3xl p-6 pb-[max(24px,env(safe-area-inset-bottom))] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mb-5" />
        <div className="flex items-start gap-3 mb-4">
          <span className="w-10 h-10 rounded-full bg-accent flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5 text-primary" />
          </span>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Get a nudge when it's time to chase</h2>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              Turn on notifications so we can remind you when an invoice is due for a follow-up.
              We never push marketing — only your own scheduled chases.
            </p>
          </div>
        </div>
        <button
          onClick={handleTurnOn}
          disabled={submitting}
          className="w-full bg-primary text-primary-foreground rounded-full py-3 font-semibold text-sm disabled:opacity-60"
        >
          {submitting ? "Asking…" : "Turn on notifications"}
        </button>
        <button
          onClick={() => dismiss(true)}
          className="w-full mt-2 text-sm text-muted-foreground py-3"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
