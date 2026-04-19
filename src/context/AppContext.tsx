import React, { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Tables } from "@/integrations/supabase/types";
import type { Invoice as FrontendInvoice } from "@/lib/data";
import { isTestingMode, clearTestingState } from "@/lib/testingMode";
import { readPending, clearPending, isGuestOnboarded, clearGuestOnboarded } from "@/lib/localInvoice";
import { createInvoice } from "@/hooks/useSupabaseData";

type DbInvoice = Tables<"invoices">;

function dbToFrontend(db: DbInvoice): FrontendInvoice {
  return {
    id: db.invoice_number,
    client: db.client,
    clientEmail: db.client_email,
    description: db.description,
    amount: Number(db.amount),
    dueDate: new Date(db.due_date).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }),
    dueDateISO: db.due_date,
    status: db.status as FrontendInvoice["status"],
    daysPastDue: db.days_past_due,
    sentFrom: db.sent_from,
    paymentDetails: db.payment_details,
    clientReply: db.client_reply_snippet ? {
      snippet: db.client_reply_snippet,
      receivedAt: db.client_reply_received_at ? new Date(db.client_reply_received_at).toLocaleString() : "Recently",
      channel: "email" as const,
      senderEmail: db.client_reply_sender_email || db.client_email,
    } : undefined,
  };
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
  fullName: string | null;
  hasCompletedOnboarding: boolean;
  notifications: NotificationSettings;
  schedule: ScheduleRow[];
  invoices: FrontendInvoice[];
  invoicesLoading: boolean;
  refetchInvoices: () => Promise<void>;
  signIn: () => void;
  signOut: () => void;
  completeOnboarding: () => Promise<void>;
  restartOnboarding: () => Promise<void>;
  updateNotifications: (settings: NotificationSettings) => void;
  updateSchedule: (schedule: ScheduleRow[]) => void;
}

const DEFAULT_SCHEDULE: ScheduleRow[] = [
  { id: 1, day: 0, action: "Invoice sent", status: "sent" },
  { id: 2, day: 7, action: "Friendly reminder", status: "reminder-1" },
  { id: 3, day: 14, action: "Firm reminder", status: "reminder-2" },
  { id: 4, day: 21, action: "Final Notice", status: "checkpoint" },
];

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [fullName, setFullName] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<FrontendInvoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [notifications, setNotifications] = useState<NotificationSettings>(() => {
    if (isTestingMode()) return { emailNotifications: true, autoChase: true, defaultTone: "Friendly" };
    const s = localStorage.getItem("notifications");
    return s ? JSON.parse(s) : { emailNotifications: true, autoChase: true, defaultTone: "Friendly" };
  });
  const [schedule, setSchedule] = useState<ScheduleRow[]>(() => {
    if (isTestingMode()) return DEFAULT_SCHEDULE;
    const s = localStorage.getItem("schedule");
    return s ? JSON.parse(s) : DEFAULT_SCHEDULE;
  });

  const lastUserIdRef = useRef<string | null>(null);
  const completedThisSessionRef = useRef(false);

  useEffect(() => {
    if (!user) {
      setHasCompletedOnboarding(false);
      setFullName(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("onboarding_completed, full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const metaName = (user.user_metadata as any)?.full_name || (user.user_metadata as any)?.name || null;
      const testing = isTestingMode();
      const guestOnboarded = isGuestOnboarded();
      if (data) {
        const testingForceFresh = testing && !completedThisSessionRef.current;
        const dbDone = !!data.onboarding_completed;
        setHasCompletedOnboarding(testingForceFresh ? false : (dbDone || guestOnboarded));
        // If the user completed onboarding as a guest, persist that to their profile now.
        if (!dbDone && guestOnboarded) {
          await supabase.from("profiles").update({ onboarding_completed: true }).eq("user_id", user.id);
        }
        const resolved = (data as any).full_name || metaName || null;
        setFullName(resolved);
        if (!(data as any).full_name && metaName) {
          await supabase.from("profiles").update({ full_name: metaName }).eq("user_id", user.id);
        }
      } else {
        await supabase.from("profiles").insert({ user_id: user.id, onboarding_completed: guestOnboarded, full_name: metaName });
        setHasCompletedOnboarding(guestOnboarded);
        setFullName(metaName);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const refetchInvoices = useCallback(async () => {
    if (!user) {
      setInvoices([]);
      setInvoicesLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setInvoices(data ? data.map(dbToFrontend) : []);
    setInvoicesLoading(false);
  }, [user]);

  // Fetch invoices once when user is set, then subscribe to realtime changes
  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setInvoices([]);
      setInvoicesLoading(false);
      return;
    }
    setInvoicesLoading(true);
    refetchInvoices();

    const channel = supabase
      .channel(`invoices-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "invoices", filter: `user_id=eq.${user.id}` },
        () => { refetchInvoices(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, authReady, refetchInvoices]);

  // Flush any pending guest-drafted invoice to the user's account once authenticated.
  const flushedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user) return;
    if (flushedRef.current === user.id) return;
    const pending = readPending();
    if (!pending) return;
    flushedRef.current = user.id;
    (async () => {
      const result = await createInvoice(user.id, {
        client: pending.client,
        clientEmail: pending.clientEmail,
        description: pending.description,
        amount: pending.amount,
        dueDate: pending.dueDate,
      });
      if (result.invoice) {
        clearPending();
        clearGuestOnboarded();
        await refetchInvoices();
      }
    })();
  }, [user, refetchInvoices]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const newUserId = session?.user?.id ?? null;
      // Clear OAuth flag when auth state changes
      if (event === "SIGNED_IN" && session?.user) {
        console.log("[AUTH] OAuth callback completed - user signed in");
        sessionStorage.removeItem("oauth_in_progress");
      }
      // Testing mode: only wipe persisted state on a *fresh* sign-in (different user id),
      // not on silent token refreshes for the same user.
      if (
        isTestingMode() &&
        event === "SIGNED_IN" &&
        newUserId &&
        newUserId !== lastUserIdRef.current &&
        !completedThisSessionRef.current
      ) {
        clearTestingState();
        setNotifications({ emailNotifications: true, autoChase: true, defaultTone: "Friendly" });
        setSchedule(DEFAULT_SCHEDULE);
        setHasCompletedOnboarding(false);
      }
      lastUserIdRef.current = newUserId;
      setUser(session?.user ?? null);
      setIsAuthenticated(!!session?.user);
      setAuthReady(true);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      lastUserIdRef.current = session?.user?.id ?? null;
      setUser(session?.user ?? null);
      setIsAuthenticated(!!session?.user);
      setAuthReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  function signIn() {}

  async function signOut() {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      // ignore — clear local state regardless
    }
    localStorage.removeItem("notifications");
    localStorage.removeItem("schedule");
    localStorage.removeItem("onboarding_done_session");
    clearPending();
    clearGuestOnboarded();
    completedThisSessionRef.current = false;
    flushedRef.current = null;
    setIsAuthenticated(false);
    setUser(null);
    setHasCompletedOnboarding(false);
    setInvoices([]);
    setNotifications({ emailNotifications: true, autoChase: true, defaultTone: "Friendly" });
    setSchedule(DEFAULT_SCHEDULE);
  }

  async function completeOnboarding() {
    completedThisSessionRef.current = true;
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

  function updateNotifications(n: NotificationSettings) {
    setNotifications(n);
    localStorage.setItem("notifications", JSON.stringify(n));
  }

  function updateSchedule(s: ScheduleRow[]) {
    setSchedule(s);
    localStorage.setItem("schedule", JSON.stringify(s));
  }

  return (
    <AppContext.Provider value={{ isAuthenticated, authReady, user, fullName, hasCompletedOnboarding, notifications, schedule, invoices, invoicesLoading, refetchInvoices, signIn, signOut, completeOnboarding, restartOnboarding, updateNotifications, updateSchedule }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
