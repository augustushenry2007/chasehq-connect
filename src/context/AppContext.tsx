import React, { createContext, useContext, useState, useEffect, type ReactNode } from "react";

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

export interface Integration {
  id: string;
  name: string;
  description: string;
  color: string;
  initial: string;
  connected: boolean;
  lastSynced?: string;
}

interface AppContextType {
  isAuthenticated: boolean;
  hasCompletedOnboarding: boolean;
  profile: UserProfile;
  notifications: NotificationSettings;
  schedule: ScheduleRow[];
  integrations: Integration[];
  signIn: () => void;
  signOut: () => void;
  completeOnboarding: () => void;
  restartOnboarding: () => void;
  updateProfile: (profile: UserProfile) => void;
  updateNotifications: (settings: NotificationSettings) => void;
  updateSchedule: (schedule: ScheduleRow[]) => void;
  toggleIntegration: (id: string) => void;
}

const DEFAULT_SCHEDULE: ScheduleRow[] = [
  { id: 1, day: 0, action: "Invoice sent", status: "sent" },
  { id: 2, day: 7, action: "Friendly reminder", status: "reminder-1" },
  { id: 3, day: 14, action: "Firm reminder", status: "reminder-2" },
  { id: 4, day: 21, action: "Formal notice — your approval needed", status: "checkpoint" },
];

const DEFAULT_INTEGRATIONS: Integration[] = [
  { id: "freshbooks", name: "FreshBooks", description: "Sync invoices automatically when marked as sent", color: "#1AB5D1", initial: "FB", connected: true, lastSynced: "2 hours ago" },
  { id: "xero", name: "Xero", description: "Import approved invoices and track payment status", color: "#13B5EA", initial: "X", connected: false },
  { id: "quickbooks", name: "QuickBooks", description: "Connect to pull invoices and monitor overdue accounts", color: "#2BA01B", initial: "QB", connected: false },
  { id: "bonsai", name: "Bonsai", description: "Automatically trigger chase sequences on unpaid invoices", color: "#6C47FF", initial: "B", connected: false },
];

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => localStorage.getItem("isAuthenticated") === "true");
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(() => localStorage.getItem("hasCompletedOnboarding") === "true");
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
  const [integrations, setIntegrations] = useState<Integration[]>(() => {
    const s = localStorage.getItem("integrations");
    return s ? JSON.parse(s) : DEFAULT_INTEGRATIONS;
  });

  function signIn() {
    setIsAuthenticated(true);
    localStorage.setItem("isAuthenticated", "true");
  }

  function signOut() {
    setIsAuthenticated(false);
    setHasCompletedOnboarding(false);
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("hasCompletedOnboarding");
  }

  function completeOnboarding() {
    setHasCompletedOnboarding(true);
    localStorage.setItem("hasCompletedOnboarding", "true");
  }

  function restartOnboarding() {
    setHasCompletedOnboarding(false);
    localStorage.setItem("hasCompletedOnboarding", "false");
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

  function toggleIntegration(id: string) {
    setIntegrations((prev) => {
      const updated = prev.map((t) =>
        t.id === id ? { ...t, connected: !t.connected, lastSynced: !t.connected ? "Just now" : undefined } : t
      );
      localStorage.setItem("integrations", JSON.stringify(updated));
      return updated;
    });
  }

  return (
    <AppContext.Provider value={{ isAuthenticated, hasCompletedOnboarding, profile, notifications, schedule, integrations, signIn, signOut, completeOnboarding, restartOnboarding, updateProfile, updateNotifications, updateSchedule, toggleIntegration }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
