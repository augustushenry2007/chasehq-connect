import { useState } from "react";
import { Bell, X } from "lucide-react";
import { useNotificationPreferences } from "@/hooks/useNotificationPreferences";
import { toast } from "sonner";

const DISMISS_KEY = "notif_permission_dismissed_v1";

export default function NotificationPermissionCard() {
  const { prefs, enableAndRequestPermission, loading } = useNotificationPreferences();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
  });
  const [busy, setBusy] = useState(false);

  if (loading || prefs.enabled || dismissed) return null;

  async function handleAllow() {
    setBusy(true);
    const granted = await enableAndRequestPermission();
    setBusy(false);
    toast.success(granted ? "Reminders on. We'll nudge you at the right time." : "Reminders saved in your inbox — enable browser notifications anytime.");
  }

  function handleDismiss() {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
    setDismissed(true);
  }

  return (
    <div className="mt-4 bg-card border border-primary/30 rounded-2xl p-4 animate-scale-in">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Bell className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Want us to remind you when it's time to follow up?</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            We'll ping you on due dates and follow-up days. No spam — just the schedule you set.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleAllow}
              disabled={busy}
              className="px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50 transition-all duration-200 active:scale-[0.97]"
            >
              {busy ? "Enabling…" : "Yes, remind me"}
            </button>
            <button
              onClick={handleDismiss}
              className="px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Not now
            </button>
          </div>
        </div>
        <button onClick={handleDismiss} aria-label="Dismiss" className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
