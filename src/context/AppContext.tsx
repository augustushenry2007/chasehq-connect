import React, { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Tables } from "@/integrations/supabase/types";
import type { Invoice as FrontendInvoice } from "@/lib/data";
import { isTestingMode, clearTestingState } from "@/lib/testingMode";
import { readPending, clearPending, isGuestOnboarded, clearGuestOnboarded } from "@/lib/localInvoice";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import { createInvoice } from "@/hooks/useSupabaseData";

type DbInvoice = Tables<"invoices">;

function dbToFrontend(db: DbInvoice): FrontendInvoice {
  return {
    id: db.invoice_number,
    dbId: db.id,
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
  defaultTone: "Polite" | "Friendly" | "Firm" | "Urgent" | "Final Notice";
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
  profileReady: boolean;
  user: User | null;
  fullName: string | null;
  hasCompletedOnboarding: boolean;
  notifications: NotificationSettings;
  schedule: ScheduleRow[];
  invoices: FrontendInvoice[];
  invoicesLoading: boolean;
  refetchInvoices: () => Promise<void>;
  flushedInvoiceId: string | null | undefined;
  signIn: () => void;
  signOut: () => void;
  completeOnboarding: () => Promise<void>;
  restartOnboarding: () => Promise<void>;
  updateNotifications: (settings: NotificationSettings) => void;
  updateSchedule: (schedule: ScheduleRow[]) => void;
  updateDisplayName: (name: string | null) => Promise<void>;
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
  // profileReady becomes true once the async profile DB query resolves (or is skipped for guests).
  const [profileReady, setProfileReady] = useState(false);
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
      setProfileReady(false);
      return;
    }
    let cancelled = false;
    // Safety net: if profile fetch hangs, unblock after 6s
    const profileTimeoutId = window.setTimeout(() => {
      if (!cancelled) {
        console.warn("[AUTH] Profile fetch timed out — forcing profileReady");
        setProfileReady(true);
      }
    }, 6000);
    (async () => {
      try {
        if (import.meta.env.DEV) console.log("[AUTH] Fetching profile for user", user.id);
        const { data, error } = await supabase
          .from("profiles")
          .select("onboarding_completed, full_name")
          .eq("user_id", user.id)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          console.error("[AUTH] Profile fetch error:", error);
        }
        const metaName = (user.user_metadata as any)?.full_name || (user.user_metadata as any)?.name || null;
        const testing = isTestingMode();
        const guestOnboarded = isGuestOnboarded();
        if (data) {
          const testingForceFresh = testing && !completedThisSessionRef.current;
          const dbDone = !!data.onboarding_completed;
          // By design, any authenticated user has already completed onboarding
          // (onboarding happens before signup). Backfill the DB if it's stale.
          const shouldBeOnboarded = testingForceFresh ? false : true;
          setHasCompletedOnboarding(shouldBeOnboarded);
          if (import.meta.env.DEV) console.log("[AUTH] Profile loaded: onboarding_completed:", dbDone, "guestOnboarded:", guestOnboarded, "→ hasCompletedOnboarding:", shouldBeOnboarded);
          if (!dbDone && shouldBeOnboarded) {
            try {
              await supabase.from("profiles").update({ onboarding_completed: true }).eq("user_id", user.id);
              if (import.meta.env.DEV) console.log("[AUTH] Backfilled onboarding_completed=true for authenticated user");
            } catch (err) {
              console.error("[AUTH] Failed to update onboarding_completed:", err);
            }
          }
          const resolved = (data as any).full_name || metaName || null;
          setFullName(resolved);
          if (!(data as any).full_name && metaName) {
            try {
              await supabase.from("profiles").update({ full_name: metaName }).eq("user_id", user.id);
            } catch (err) {
              console.error("[AUTH] Failed to update full_name:", err);
            }
          }
        } else {
          // Onboarding happens before signup by design, so any freshly-created
          // profile belongs to a user who has already completed onboarding.
          try {
            await supabase.from("profiles").insert({ user_id: user.id, onboarding_completed: true, full_name: metaName });
          } catch (err) {
            console.error("[AUTH] Failed to insert profile:", err);
          }
          setHasCompletedOnboarding(true);
          setFullName(metaName);
          if (import.meta.env.DEV) console.log("[AUTH] Profile created for signed-up user → hasCompletedOnboarding: true");
        }
      } catch (err) {
        console.error("[AUTH] Profile load exception:", err);
      } finally {
        window.clearTimeout(profileTimeoutId);
        if (!cancelled) {
          if (import.meta.env.DEV) console.log("[AUTH] Setting profileReady = true");
          setProfileReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(profileTimeoutId);
    };
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
  const [flushedInvoiceId, setFlushedInvoiceId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!user) return;
    if (flushedRef.current === user.id) return;
    const pending = readPending();
    if (!pending) {
      setFlushedInvoiceId(null);
      return;
    }
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
        setFlushedInvoiceId(result.invoice.invoice_number);
      } else {
        setFlushedInvoiceId(null);
      }
      try {
        const pendingTone = localStorage.getItem("pending_draft_tone_v1") as "Polite" | "Friendly" | "Firm" | null;
        if (pendingTone && ["Polite", "Friendly", "Firm"].includes(pendingTone)) {
          setNotifications(prev => ({ ...prev, defaultTone: pendingTone }));
        }
        localStorage.removeItem("pending_draft_tone_v1");
      } catch {}
    })();
  }, [user, refetchInvoices]);

  useEffect(() => {
    let authReadySet = false;
    const markAuthReady = (session: import("@supabase/supabase-js").Session | null) => {
      authReadySet = true;
      lastUserIdRef.current = session?.user?.id ?? null;
      setUser(session?.user ?? null);
      setIsAuthenticated(!!session?.user);
      setAuthReady(true);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const newUserId = session?.user?.id ?? null;
      // Mark OAuth completion but don't remove flag yet - FlowBootstrap needs it
      if (event === "SIGNED_IN" && session?.user) {
        if (import.meta.env.DEV) console.log("[AUTH] OAuth callback completed - user signed in");
        sessionStorage.setItem(STORAGE_KEYS.OAUTH_COMPLETED, "1");

        // If Google returned provider tokens (gmail.send scope granted during signup),
        // persist them to gmail_connections so send-email can use them immediately
        // without requiring a separate "Connect Gmail" OAuth round-trip.
        if (import.meta.env.DEV) console.log("[AUTH] SIGNED_IN — provider_token present:", !!session.provider_token, "provider_refresh_token present:", !!session.provider_refresh_token);
        if (session.provider_token && session.provider_refresh_token) {
          const expiresAt = new Date(Date.now() + 55 * 60 * 1000).toISOString();
          supabase.from("gmail_connections").upsert({
            user_id: session.user.id,
            email: session.user.email,
            access_token: session.provider_token,
            refresh_token: session.provider_refresh_token,
            token_expires_at: expiresAt,
          }, { onConflict: "user_id" }).then(({ error }) => {
            if (error) console.error("[AUTH] Failed to persist Gmail tokens:", error);
            else if (import.meta.env.DEV) console.log("[AUTH] Gmail tokens persisted to gmail_connections");
          });
        }
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
      markAuthReady(session);
    });

    // If the URL has an access_token hash (email confirmation redirect), supabase
    // processes it asynchronously. Calling getSession() immediately races against
    // that processing and may return null before the session is saved.
    // When the hash is present, skip getSession and wait for onAuthStateChange to
    // fire SIGNED_IN — the 8s timeout below is the safety net.
    const hasUrlToken = window.location.hash.includes('access_token=');

    const authTimeoutId = window.setTimeout(() => {
      if (!authReadySet) {
        console.warn("[AUTH] Auth initialization timed out — forcing authReady with no session");
        markAuthReady(null);
      }
    }, 8000);

    if (!hasUrlToken) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        window.clearTimeout(authTimeoutId);
        if (!authReadySet) markAuthReady(session);
      }).catch(() => {
        window.clearTimeout(authTimeoutId);
        if (!authReadySet) markAuthReady(null);
      });
    }

    return () => {
      subscription.unsubscribe();
      window.clearTimeout(authTimeoutId);
    };
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
    localStorage.removeItem(STORAGE_KEYS.ONBOARDING_DONE_SESSION);
    clearPending();
    clearGuestOnboarded();
    completedThisSessionRef.current = false;
    flushedRef.current = null;
    setFlushedInvoiceId(undefined);
    setIsAuthenticated(false);
    setUser(null);
    setProfileReady(false);
    setHasCompletedOnboarding(false);
    setInvoices([]);
    setNotifications({ emailNotifications: true, autoChase: true, defaultTone: "Friendly" });
    setSchedule(DEFAULT_SCHEDULE);
  }

  async function completeOnboarding() {
    completedThisSessionRef.current = true;
    setHasCompletedOnboarding(true);
    if (user) {
      supabase
        .from("profiles")
        .upsert({ user_id: user.id, onboarding_completed: true }, { onConflict: "user_id" })
        .then(({ error }) => {
          if (error) console.error("[AUTH] completeOnboarding upsert failed:", error);
        });
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
    if (user) {
      supabase.from("notification_preferences").upsert({
        user_id: user.id,
        enabled: n.autoChase,
        email_enabled: n.emailNotifications,
      }, { onConflict: "user_id" }).then(({ error }) => {
        if (error) console.error("Failed to sync notification prefs:", error);
      });
    }
  }

  function updateSchedule(s: ScheduleRow[]) {
    setSchedule(s);
    localStorage.setItem("schedule", JSON.stringify(s));
  }

  async function updateDisplayName(name: string | null) {
    const trimmed = name?.trim() || null;
    setFullName(trimmed);
    if (user) {
      await supabase.from("profiles").update({ full_name: trimmed }).eq("user_id", user.id);
    }
  }

  return (
    <AppContext.Provider value={{ isAuthenticated, authReady, profileReady, user, fullName, hasCompletedOnboarding, notifications, schedule, invoices, invoicesLoading, refetchInvoices, flushedInvoiceId, signIn, signOut, completeOnboarding, restartOnboarding, updateNotifications, updateSchedule, updateDisplayName }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
