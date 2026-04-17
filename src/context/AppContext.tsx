import React, { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

interface UserProfile {
  name: string;
  email: string;
  paymentDetails: string;
}

interface NotificationSettings {
  emailNotifications: boolean;
  autoChase: boolean;
  defaultTone: "Polite" | "Friendly" | "Firm" | "Urgent";
}

export interface ScheduleRow {
  id: number;
  day: number;
  action: string;
  status: "sent" | "reminder-1" | "reminder-2" | "checkpoint";
}

interface AppContextType {
  isAuthenticated: boolean;
  authReady: boolean;
  user: User | null;
  hasCompletedOnboarding: boolean;
  isDemoUser: boolean;
  profile: UserProfile;
  notifications: NotificationSettings;
  schedule: ScheduleRow[];
  signIn: () => void;
  signOut: () => void;
  completeOnboarding: () => Promise<void>;
  restartOnboarding: () => Promise<void>;
  updateProfile: (profile: UserProfile) => void;
  updateNotifications: (settings: NotificationSettings) => void;
  updateSchedule: (schedule: ScheduleRow[]) => void;
}

const DEMO_EMAIL = "demo@chasehq.app";

const DEFAULT_SCHEDULE: ScheduleRow[] = [
  { id: 1, day: 0, action: "Invoice sent", status: "sent" },
  { id: 2, day: 7, action: "Friendly reminder", status: "reminder-1" },
  { id: 3, day: 14, action: "Firm reminder", status: "reminder-2" },
  { id: 4, day: 21, action: "Formal notice — your approval needed", status: "checkpoint" },
];

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [profile, setProfile] = useState<UserProfile>(() => {
    const s = localStorage.getItem("profile");
    return s ? JSON.parse(s) : { name: "Jamie Doe", email: "jamie@studio.co", paymentDetails: "Bank transfer · Account: 12345678 · Sort code: 12-34-56" };
  });
  const [notifications, setNotifications] = useState<NotificationSettings>(() => {
    const s = localStorage.getItem("notifications");
    return s ? JSON.parse(s) : { emailNotifications: true, autoChase: true, defaultTone: "Friendly" };
  });
  const [schedule, setSchedule] = useState<ScheduleRow[]>(() => {
    const s = localStorage.getItem("schedule");
    return s ? JSON.parse(s) : DEFAULT_SCHEDULE;
  });

  const isDemoUser = user?.email === DEMO_EMAIL;

  // Load onboarding state from profiles table whenever the user changes
  useEffect(() => {
    if (!user) {
      setHasCompletedOnboarding(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setHasCompletedOnboarding(!!data.onboarding_completed);
      } else {
        // Profile row doesn't exist yet (e.g. trigger lag) — create it
        await supabase.from("profiles").insert({ user_id: user.id, onboarding_completed: false });
        setHasCompletedOnboarding(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsAuthenticated(!!session?.user);
      setAuthReady(true);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsAuthenticated(!!session?.user);
      setAuthReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  function signIn() {
    // Handled by Supabase auth - this is a no-op now
  }

  async function signOut() {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setUser(null);
    setHasCompletedOnboarding(false);
  }

  async function completeOnboarding() {
    setHasCompletedOnboarding(true);
    if (user) {
      await supabase
        .from("profiles")
        .upsert({ user_id: user.id, onboarding_completed: true }, { onConflict: "user_id" });
    }
  }

  async function restartOnboarding() {
    setHasCompletedOnboarding(false);
    if (user) {
      await supabase
        .from("profiles")
        .upsert({ user_id: user.id, onboarding_completed: false }, { onConflict: "user_id" });
    }
  }

  function updateProfile(p: UserProfile) {
    setProfile(p);
    localStorage.setItem("profile", JSON.stringify(p));
  }

  function updateNotifications(n: NotificationSettings) {
    setNotifications(n);
    localStorage.setItem("notifications", JSON.stringify(n));
  }

  function updateSchedule(s: ScheduleRow[]) {
    setSchedule(s);
    localStorage.setItem("schedule", JSON.stringify(s));
  }

  return (
    <AppContext.Provider value={{ isAuthenticated, authReady, user, hasCompletedOnboarding, isDemoUser, profile, notifications, schedule, signIn, signOut, completeOnboarding, restartOnboarding, updateProfile, updateNotifications, updateSchedule }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
