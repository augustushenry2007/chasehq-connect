import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/context/AppContext";
import { getUserTimezone } from "@/lib/scheduleDefaults";

export type NotificationPrefs = {
  enabled: boolean;
  email_enabled: boolean;
  push_enabled: boolean;
  quiet_hours_start: number;
  quiet_hours_end: number;
  timezone: string;
};

const DEFAULT_PREFS: NotificationPrefs = {
  enabled: false, // default OFF until user opts in after first send
  email_enabled: false,
  push_enabled: true,
  quiet_hours_start: 21,
  quiet_hours_end: 8,
  timezone: getUserTimezone(),
};

export function useNotificationPreferences() {
  const { user, isAuthenticated } = useApp();
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user?.id) {
      setPrefs(DEFAULT_PREFS);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      setPrefs({
        enabled: data.enabled,
        email_enabled: data.email_enabled,
        push_enabled: data.push_enabled,
        quiet_hours_start: data.quiet_hours_start,
        quiet_hours_end: data.quiet_hours_end,
        timezone: data.timezone,
      });
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (isAuthenticated) refetch();
    else setLoading(false);
  }, [isAuthenticated, refetch]);

  async function update(patch: Partial<NotificationPrefs>) {
    if (!user?.id) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    await supabase.from("notification_preferences").upsert({
      user_id: user.id,
      enabled: next.enabled,
      email_enabled: next.email_enabled,
      push_enabled: next.push_enabled,
      quiet_hours_start: next.quiet_hours_start,
      quiet_hours_end: next.quiet_hours_end,
      timezone: next.timezone,
    });
  }

  async function enableAndRequestPermission(): Promise<boolean> {
    // Try Capacitor LocalNotifications first (mobile), fall back to Web Notification.
    let granted = false;
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      const result = await LocalNotifications.requestPermissions();
      granted = result.display === "granted";
    } catch {
      // Web fallback
      if (typeof window !== "undefined" && "Notification" in window) {
        const res = await Notification.requestPermission();
        granted = res === "granted";
      } else {
        granted = true; // No native API — just record the in-app preference.
      }
    }
    await update({ enabled: true, push_enabled: granted });
    return granted;
  }

  return { prefs, loading, update, enableAndRequestPermission, refetch };
}
