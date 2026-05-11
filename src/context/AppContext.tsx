import React, { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Tables } from "@/integrations/supabase/types";
import type { Invoice as FrontendInvoice } from "@/lib/data";
import { DEMO_INVOICES, DEMO_USER, DEMO_FULL_NAME } from "@/lib/demoData";
import { formatDate } from "@/lib/data";
import { isTestingMode, clearTestingState } from "@/lib/testingMode";
import { readPending, clearPending, isGuestOnboarded, clearGuestOnboarded } from "@/lib/localInvoice";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import { createInvoice } from "@/hooks/useSupabaseData";
import { computeInvoiceStatus, computeDaysPastDue } from "@/lib/invoiceStatus";
import { getUserTimezone } from "@/lib/scheduleDefaults";
import { configureRC, logoutRC, isNativePlatform, syncSubscriptionToSupabase } from "@/integrations/iap";
import { Purchases } from "@revenuecat/purchases-capacitor";
import type { UserProfile } from "@/lib/userProfile/types";
import { readLocalUserProfile, clearLocalUserProfile, clearDemoUserProfile, readProfileCache, writeProfileCache } from "@/lib/userProfile/storage";
import { toTitleCase } from "@/lib/textCase";
import { analytics } from "@/integrations/analytics";
import { toast } from "sonner";

type DbInvoice = Tables<"invoices">;

function dbToFrontend(db: DbInvoice): FrontendInvoice {
  return {
    id: db.invoice_number,
    dbId: db.id,
    client: db.client,
    clientEmail: db.client_email,
    description: db.description,
    amount: Number(db.amount),
    dueDate: formatDate(db.due_date),
    dueDateISO: db.due_date,
    createdAtISO: db.created_at,
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
  defaultTone: "Friendly" | "Firm" | "Urgent" | "Final Notice";
}

interface AppContextType {
  isAuthenticated: boolean;
  authReady: boolean;
  profileReady: boolean;
  user: User | null;
  fullName: string | null;
  hasCompletedOnboarding: boolean;
  tourCompleted: boolean;
  dismissedHints: Record<string, boolean>;
  onboardingStep: number;
  notifications: NotificationSettings;
  invoices: FrontendInvoice[];
  invoicesLoading: boolean;
  invoicesError: boolean;
  refetchInvoices: () => Promise<void>;
  flushedInvoiceId: string | null | undefined;
  isDemo: boolean;
  addDemoInvoice?: (inv: FrontendInvoice) => void;
  userProfile: UserProfile;
  refreshUserProfile: () => void;
  signIn: () => void;
  signOut: () => void;
  completeOnboarding: () => Promise<void>;
  restartOnboarding: () => Promise<void>;
  updateOnboardingStep: (step: number) => Promise<void>;
  updateNotifications: (settings: NotificationSettings) => void;
  updateDisplayName: (name: string | null) => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

function AppProviderDemo({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [demoInvoices, setDemoInvoices] = useState<FrontendInvoice[]>(DEMO_INVOICES);
  // Reactive profile: reads from demo-namespaced localStorage keys (with fallbacks
  // to designer/overthinking defaults for fresh sessions). Updated by refreshUserProfile()
  // which OnboardingScreen calls at the end of applyOnboardingDefaults().
  const [userProfileLocal, setUserProfileLocal] = useState(() => readLocalUserProfile());

  const refreshUserProfile = useCallback(() => {
    setUserProfileLocal(readLocalUserProfile());
  }, []);

  const addDemoInvoice = useCallback((inv: FrontendInvoice) => {
    setDemoInvoices(prev => [inv, ...prev]);
  }, []);

  useEffect(() => { clearGuestOnboarded(); }, []);

  const userProfile: UserProfile = {
    ...userProfileLocal,
    tone: "Friendly",
    displayName: DEMO_FULL_NAME ?? undefined,
  };

  const value: AppContextType = {
    isAuthenticated, authReady: true, profileReady: true,
    isDemo: true,
    user: isAuthenticated ? DEMO_USER : null, fullName: DEMO_FULL_NAME,
    hasCompletedOnboarding, tourCompleted: false,
    dismissedHints: {}, onboardingStep: 6,
    notifications: { emailNotifications: true, autoChase: true, defaultTone: "Friendly" },
    invoices: demoInvoices, invoicesLoading: false, invoicesError: false,
    refetchInvoices: async () => {}, flushedInvoiceId: null,
    addDemoInvoice,
    userProfile,
    refreshUserProfile,
    signIn: () => {},
    signOut: () => { clearDemoUserProfile(); localStorage.removeItem("chasehq_demo_mode"); clearGuestOnboarded(); window.location.reload(); },
    completeOnboarding: async () => { setIsAuthenticated(true); setHasCompletedOnboarding(true); },
    restartOnboarding: async () => {}, updateOnboardingStep: async () => {},
    updateNotifications: () => {}, updateDisplayName: async () => {},
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

function AppProviderReal({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  // profileReady becomes true once the async profile DB query resolves (or is skipped for guests).
  const [profileReady, setProfileReady] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [tourCompleted, setTourCompleted] = useState(false);
  const [dismissedHints, setDismissedHints] = useState<Record<string, boolean>>({});
  const [onboardingStep, setOnboardingStep] = useState<number>(1);
  const [fullName, setFullName] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<FrontendInvoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [invoicesError, setInvoicesError] = useState(false);
  const [notifications, setNotifications] = useState<NotificationSettings>(() => {
    try {
      if (isTestingMode()) return { emailNotifications: true, autoChase: true, defaultTone: "Friendly" };
      const s = localStorage.getItem("notifications");
      if (s) {
        const parsed = JSON.parse(s);
        if (parsed.defaultTone === "Polite") parsed.defaultTone = "Friendly";
        return parsed;
      }
    } catch (e) {
      console.warn("[AppContext] Could not read 'notifications' from storage — using defaults:", e);
    }
    return { emailNotifications: true, autoChase: true, defaultTone: "Friendly" };
  });
  const [userProfileLocal, setUserProfileLocal] = useState(() => readLocalUserProfile());

  const refreshUserProfile = useCallback(() => {
    setUserProfileLocal(readLocalUserProfile());
  }, []);

  const lastUserIdRef = useRef<string | null>(null);
  const completedThisSessionRef = useRef(false);
  // True once the DB write of profiles.onboarding_completed=true has been acknowledged.
  // Used to decide whether the profile fetch is allowed to downgrade hasCompletedOnboarding.
  const onboardingConfirmedRef = useRef(false);
  // Serializes profiles.onboarding_step writes so rapid back/next taps can't land out of order.
  const stepWriteChainRef = useRef<Promise<unknown>>(Promise.resolve());
  // Monotonic counter so a slow invoices fetch can't overwrite a fresher one.
  const invoicesFetchSeqRef = useRef(0);

  useEffect(() => {
    if (!user) {
      setHasCompletedOnboarding(false);
      setFullName(null);
      setProfileReady(false);
      return;
    }

    // Always synchronously prime from per-user cache when available. The async
    // fetch below always runs regardless and inserts a profile row if none exists.
    const cached = readProfileCache(user.id);
    if (cached) {
      setHasCompletedOnboarding(cached.onboarding_completed);
      setTourCompleted(cached.tour_completed);
      setFullName(cached.full_name);
      setProfileReady(true);
    } else if ((user.user_metadata as Record<string, unknown> | undefined)?.onboarding_completed === true) {
      // No device cache (fresh install / cleared storage / new device). Trust the
      // auth-metadata mirror written by completeOnboarding so that if the DB fetch
      // below is slow and the 6s timeout fires first, the flow still boots to the
      // dashboard rather than flickering through onboarding. The DB fetch is still
      // authoritative — if it says onboarding isn't done, it will correct this.
      setHasCompletedOnboarding(true);
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
          .select("onboarding_completed, onboarding_step, full_name, tour_completed")
          .eq("user_id", user.id)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          console.error("[AUTH] Profile fetch error:", error);
          analytics.error("profile_fetch_error", error.message, { userId: user.id });
        }
        const rawMetaName = (user.user_metadata as any)?.full_name || (user.user_metadata as any)?.name || null;
        const metaName = rawMetaName ? toTitleCase(rawMetaName) : null;
        const testing = isTestingMode();
        const guestOnboarded = isGuestOnboarded();
        const hasPending = readPending() !== null;
        const effectivelyOnboarded = guestOnboarded || hasPending;
        if (data) {
          const testingForceFresh = testing && !completedThisSessionRef.current;
          const dbDone = !!data.onboarding_completed;
          // Never let the fetch downgrade onboarding to "not done" if the user
          // finished it this session — the DB write may still be in flight or may
          // have failed transiently (completeOnboarding retries it in the background).
          const resolvedDone = testingForceFresh ? false : (dbDone || effectivelyOnboarded || completedThisSessionRef.current);
          if (!dbDone && resolvedDone && !testingForceFresh) {
            try {
              await supabase.from("profiles")
                .update({ onboarding_completed: true })
                .eq("user_id", user.id);
            } catch (err) {
              console.error("[AUTH] Failed to backfill onboarding_completed:", err);
            }
          }
          setHasCompletedOnboarding(resolvedDone);
          setTourCompleted(!!(data as any).tour_completed);
          setDismissedHints(((data as any).dismissed_hints as Record<string, boolean>) ?? {});
          const dbStep = typeof (data as any).onboarding_step === "number" ? (data as any).onboarding_step : 1;
          setOnboardingStep(dbStep);
          if (import.meta.env.DEV) console.log("[AUTH] Profile loaded: onboarding_completed:", dbDone, "onboarding_step:", dbStep, "guestOnboarded:", guestOnboarded, "→ hasCompletedOnboarding:", resolvedDone);
          const resolvedName = (data as any).full_name || metaName || null;
          setFullName(resolvedName);
          if (!(data as any).full_name && metaName) {
            try {
              await supabase.from("profiles").update({ full_name: metaName }).eq("user_id", user.id);
            } catch (err) {
              console.error("[AUTH] Failed to update full_name:", err);
            }
          }
          writeProfileCache(user.id, {
            onboarding_completed: resolvedDone,
            tour_completed: !!(data as any).tour_completed,
            full_name: resolvedName,
          });
          sessionStorage.removeItem(STORAGE_KEYS.SIGN_IN_INTENT);
        } else {
          sessionStorage.removeItem(STORAGE_KEYS.SIGN_IN_INTENT);
          // No profile in DB → treat as sign-up regardless of which CTA was clicked
          // on /welcome. Both buttons lead to the same OnboardingScreen. A user who
          // signed up via the post-invoice flow with a pending invoice is already
          // effectively onboarded (handled below via effectivelyOnboarded).
          const onboardedByGuestFlow = effectivelyOnboarded || completedThisSessionRef.current;
          const initialStep = onboardedByGuestFlow ? 6 : 1;
          try {
            await supabase.from("profiles").insert({
              user_id: user.id,
              onboarding_completed: onboardedByGuestFlow,
              onboarding_step: initialStep,
              full_name: metaName,
            });
          } catch (err) {
            console.error("[AUTH] Failed to insert profile:", err);
          }
          setHasCompletedOnboarding(onboardedByGuestFlow);
          setOnboardingStep(initialStep);
          setFullName(metaName);
          writeProfileCache(user.id, {
            onboarding_completed: onboardedByGuestFlow,
            tour_completed: false,
            full_name: metaName,
          });
          if (import.meta.env.DEV) console.log("[AUTH] Profile created → hasCompletedOnboarding:", onboardedByGuestFlow, "onboarding_step:", initialStep);
        }
      } catch (err) {
        console.error("[AUTH] Profile load exception:", err);
        analytics.error("profile_load_exception", err instanceof Error ? err.message : String(err), { userId: user.id });
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
  }, [user?.id]);

  // Keep per-user cache in sync with live state so the next sign-in is instant.
  useEffect(() => {
    if (!user?.id || !profileReady) return;
    writeProfileCache(user.id, {
      onboarding_completed: hasCompletedOnboarding,
      tour_completed: tourCompleted,
      full_name: fullName,
    });
  }, [user?.id, profileReady, hasCompletedOnboarding, tourCompleted, fullName]);

  // Make sure a notification_preferences row exists carrying the user's real
  // timezone — dispatch-notifications' quiet-hours math reads it and otherwise
  // defaults to UTC, mistiming reminders — and reconcile the follow-up-schedule
  // prefs (preset / custom steps / default tone) between localStorage and the
  // server. Precedence: the server wins if it has a value (it survives reinstall
  // / new device); otherwise local is pushed up (one-time migration of the old
  // local-only state — also covers onboarding's localStorage-only writes).
  // Only ever touches user_id + timezone + the three schedule columns, so the
  // enabled/email_enabled toggles the user owns aren't disturbed on an existing row.
  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;
    (async () => {
      const { data: row, error } = await supabase
        .from("notification_preferences")
        .select("schedule_preset, schedule_steps, default_tone")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) console.warn("[AppContext] notification_preferences read failed:", error.message);

      const localPreset = localStorage.getItem(STORAGE_KEYS.SCHEDULE_PRESET);
      let localSteps: unknown[] | null = null;
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.SCHEDULE_CUSTOM_STEPS);
        const parsed = raw ? JSON.parse(raw) : null;
        localSteps = Array.isArray(parsed) ? parsed : null;
      } catch { localSteps = null; }

      const upsertPayload: Record<string, unknown> = { user_id: userId, timezone: getUserTimezone() };

      // schedule_preset
      if (row?.schedule_preset != null) {
        if (row.schedule_preset !== localPreset) {
          try { localStorage.setItem(STORAGE_KEYS.SCHEDULE_PRESET, row.schedule_preset); } catch { /* storage unavailable */ }
        }
      } else if (localPreset) {
        upsertPayload.schedule_preset = localPreset;
      }

      // schedule_steps
      if (Array.isArray(row?.schedule_steps) && (row!.schedule_steps as unknown[]).length > 0) {
        try { localStorage.setItem(STORAGE_KEYS.SCHEDULE_CUSTOM_STEPS, JSON.stringify(row!.schedule_steps)); } catch { /* storage unavailable */ }
      } else if (row && row.schedule_steps == null && row.schedule_preset != null) {
        // Server has a preset and explicitly no custom steps → drop any stale local steps.
        try { localStorage.removeItem(STORAGE_KEYS.SCHEDULE_CUSTOM_STEPS); } catch { /* storage unavailable */ }
      } else if (localSteps && localSteps.length > 0) {
        upsertPayload.schedule_steps = localSteps;
      }

      // default_tone
      if (row?.default_tone != null) {
        const serverTone = row.default_tone as NotificationSettings["defaultTone"];
        setNotifications(prev => {
          if (prev.defaultTone === serverTone) return prev;
          const next = { ...prev, defaultTone: serverTone };
          try { localStorage.setItem("notifications", JSON.stringify(next)); } catch { /* storage unavailable */ }
          return next;
        });
      } else {
        upsertPayload.default_tone = notifications.defaultTone;
      }

      const { error: upErr } = await supabase
        .from("notification_preferences")
        .upsert(upsertPayload, { onConflict: "user_id" });
      if (upErr) console.warn("[AppContext] notification_preferences upsert failed:", upErr.message);
    })().catch((e) => console.warn("[AppContext] notification_preferences sync threw:", e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    let callbackId: string | null = null;

    configureRC(user.id).then((ready) => {
      if (!ready || !isNativePlatform()) return;
      Purchases.addCustomerInfoUpdateListener((_customerInfo) => {
        // Auto-sync removed — handleStartTrial and handleRestorePurchases handle this explicitly.
      }).then((id) => { callbackId = id; }).catch(() => {});
    });

    return () => {
      if (callbackId) {
        Purchases.removeCustomerInfoUpdateListener({ listenerToRemove: callbackId }).catch(() => {});
      }
    };
  }, [user?.id]);

  const refetchInvoices = useCallback(async () => {
    if (!user) {
      setInvoices([]);
      setInvoicesLoading(false);
      setInvoicesError(false);
      return;
    }
    const seq = ++invoicesFetchSeqRef.current;
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .order("created_at", { ascending: false });
      // A newer fetch (e.g. triggered by a realtime INSERT) started after this one —
      // discard this response so a slow fetch can't clobber the fresher list. The
      // newer fetch owns the loading flag, so we don't clear it here.
      if (seq !== invoicesFetchSeqRef.current) return;
      if (error) {
        console.error("[AppContext] refetchInvoices error:", error);
        analytics.error("refetch_invoices_error", error.message, { userId: user.id });
        setInvoicesError(true);
      } else {
        // Recompute status and days_past_due on load. The daily cron persists the
        // same values to the DB; this gives the UI correct state immediately
        // without waiting for the next cron tick.
        const today = new Date();
        const mapped = (data ?? []).map(dbToFrontend).map((inv) => ({
          ...inv,
          status: computeInvoiceStatus(inv, today),
          daysPastDue: computeDaysPastDue(inv, today),
        }));
        setInvoices(mapped);
        setInvoicesError(false);
      }
      setInvoicesLoading(false);
    } catch (err) {
      // iOS/WKWebView transport errors reject rather than returning {error}.
      // Without clearing the loading flag here the dashboard/invoices screens
      // stay stuck on a skeleton until a later realtime event triggers a
      // successful refetch. A superseded fetch leaves the flag to the newer one.
      if (seq !== invoicesFetchSeqRef.current) return;
      console.error("[AppContext] refetchInvoices threw:", err);
      analytics.error("refetch_invoices_exception", err instanceof Error ? err.message : String(err), { userId: user.id });
      setInvoicesError(true);
      setInvoicesLoading(false);
    }
  }, [user?.id]);

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
  }, [user?.id, authReady, refetchInvoices]);

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

    let cancelled = false;
    // Hard safety net: createInvoice / supabase-js's _acquireLock / WKWebView fetch
    // can hang or throw on iOS Capacitor (transport-level errors don't return
    // {error}, they reject). Without this, flushedInvoiceId stays undefined
    // forever and PostInvoiceAuthScreen's dispatch effect never fires →
    // user stuck on /auth-after-invoice. null means "decided, proceed".
    const flushTimeoutId = window.setTimeout(() => {
      if (cancelled) return;
      console.warn("[FLUSH] Invoice flush timed out — unblocking PostInvoiceAuthScreen with AUTH_SUCCESS path");
      setFlushedInvoiceId(null);
    }, 10000);

    (async () => {
      try {
        if (import.meta.env.DEV) console.log("[FLUSH] Starting invoice flush for", pending.client);
        // onDuplicate:"returnExisting" — if a prior flush attempt was interrupted
        // (createInvoice exceeded the 10s safety timeout / the app was closed)
        // *after* the row was inserted server-side, this re-run would otherwise
        // hit UNIQUE(user_id, invoice_number) and surface a confusing "Invoice ID
        // already used" toast for an invoice that exists. Instead, return that row
        // silently and proceed exactly as on the happy path. Idempotent re-flush.
        const result = await createInvoice(user.id, {
          client: pending.client,
          clientEmail: pending.clientEmail,
          description: pending.description,
          amount: pending.amount,
          dueDate: pending.dueDate,
        }, "", { onDuplicate: "returnExisting" });
        if (cancelled) return;
        if (result.invoice) {
          if (import.meta.env.DEV) console.log("[FLUSH] Invoice created:", result.invoice.invoice_number);
          clearPending();
          clearGuestOnboarded();
          await refetchInvoices();
          if (cancelled) return;
          setFlushedInvoiceId(result.invoice.invoice_number);
        } else {
          if (import.meta.env.DEV) console.log("[FLUSH] createInvoice returned no invoice (error:", result.error, ")");
          setFlushedInvoiceId(null);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("[FLUSH] Invoice flush threw — unblocking with AUTH_SUCCESS path:", err);
        analytics.error("guest_invoice_flush_exception", err instanceof Error ? err.message : String(err), { userId: user.id });
        setFlushedInvoiceId(null);
      } finally {
        window.clearTimeout(flushTimeoutId);
        try {
          const raw = localStorage.getItem("pending_draft_tone_v1");
          const pendingTone = raw === "Polite" ? "Friendly" : raw as "Friendly" | "Firm" | null;
          if (pendingTone && ["Friendly", "Firm"].includes(pendingTone)) {
            setNotifications(prev => ({ ...prev, defaultTone: pendingTone }));
          }
          localStorage.removeItem("pending_draft_tone_v1");
        } catch {}
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(flushTimeoutId);
    };
  }, [user?.id, refetchInvoices]);

  useEffect(() => {
    let authReadySet = false;
    const markAuthReady = (session: import("@supabase/supabase-js").Session | null) => {
      authReadySet = true;
      const newUserId = session?.user?.id ?? null;
      // Only push a new user reference downstream when identity actually changes.
      // TOKEN_REFRESHED fires repeatedly with the same user.id but a fresh object
      // ref — propagating those triggers re-renders in every useApp() consumer,
      // which churns realtime channels and saturates SecureStoragePlugin.get.
      if (newUserId !== lastUserIdRef.current) {
        lastUserIdRef.current = newUserId;
        setUser(session?.user ?? null);
        setIsAuthenticated(!!session?.user);
      }
      setAuthReady(true);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const newUserId = session?.user?.id ?? null;
      // Mark OAuth completion but don't remove flag yet - FlowBootstrap needs it
      if (event === "SIGNED_IN" && session?.user) {
        if (import.meta.env.DEV) console.log("[AUTH] OAuth callback completed - user signed in");
        sessionStorage.setItem(STORAGE_KEYS.OAUTH_COMPLETED, "1");
        sessionStorage.removeItem(STORAGE_KEYS.USER_INITIATED_SIGN_OUT);
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
    // Tear down all realtime channels *before* clearing auth state so a queued
    // postgres_changes event can't fire a refetch against a half-cleared session.
    try { await supabase.removeAllChannels(); } catch { /* best-effort */ }
    try { await logoutRC(); } catch {}
    try {
      await supabase.auth.signOut();
    } catch (e) {
      // ignore — clear local state regardless
    }
    localStorage.removeItem("notifications");
    localStorage.removeItem(STORAGE_KEYS.ONBOARDING_DONE_SESSION);
    clearLocalUserProfile();
    sessionStorage.removeItem(STORAGE_KEYS.OAUTH_IN_PROGRESS);
    sessionStorage.removeItem(STORAGE_KEYS.OAUTH_COMPLETED);
    sessionStorage.removeItem(STORAGE_KEYS.SIGN_IN_INTENT);
    // Tell FlowBootstrap this is a deliberate sign-out, not the brief Supabase
    // session rotation that follows OAuth — otherwise the OAUTH_COMPLETED window
    // would suppress the SIGN_OUT transition and strand the user on the dashboard.
    try { sessionStorage.setItem(STORAGE_KEYS.USER_INITIATED_SIGN_OUT, "1"); } catch { /* storage unavailable */ }
    clearPending();
    clearGuestOnboarded();
    completedThisSessionRef.current = false;
    onboardingConfirmedRef.current = false;
    flushedRef.current = null;
    setFlushedInvoiceId(undefined);
    setIsAuthenticated(false);
    setUser(null);
    setProfileReady(false);
    setHasCompletedOnboarding(false);
    setTourCompleted(false);
    setDismissedHints({});
    setOnboardingStep(1);
    setInvoices([]);
    setNotifications({ emailNotifications: true, autoChase: true, defaultTone: "Friendly" });
    setUserProfileLocal(readLocalUserProfile());
  }

  async function completeOnboarding() {
    completedThisSessionRef.current = true;
    onboardingConfirmedRef.current = false;
    setHasCompletedOnboarding(true);
    setOnboardingStep(6);
    if (!user) return;
    const userId = user.id;
    const persist = async (): Promise<boolean> => {
      const { error } = await supabase
        .from("profiles")
        .upsert({ user_id: userId, onboarding_completed: true, onboarding_step: 6 }, { onConflict: "user_id" });
      if (error) {
        console.warn("[AUTH] completeOnboarding upsert failed:", error);
        return false;
      }
      return true;
    };
    const mirrorToAuthMetadata = () => {
      // Lets the next launch read onboarding completion synchronously from
      // getSession() before the profiles fetch resolves (see profile-effect prime).
      void supabase.auth.updateUser({ data: { onboarding_completed: true } })
        .catch((e) => console.warn("[AUTH] updateUser onboarding flag failed:", e));
    };
    if (await persist()) {
      onboardingConfirmedRef.current = true;
      mirrorToAuthMetadata();
      return;
    }
    // First write failed (offline / flaky). Retry in the background with backoff so
    // the user isn't blocked, but onboarding still becomes durable once connectivity
    // returns. completedThisSessionRef keeps the in-session state correct meanwhile.
    void (async () => {
      for (const delayMs of [2000, 5000, 15000, 60000]) {
        await new Promise((r) => setTimeout(r, delayMs));
        if (onboardingConfirmedRef.current) return;
        if (await persist()) {
          onboardingConfirmedRef.current = true;
          mirrorToAuthMetadata();
          return;
        }
      }
      console.error("[AUTH] completeOnboarding upsert still failing after retries — onboarding may re-run on next launch");
    })();
  }

  async function restartOnboarding() {
    completedThisSessionRef.current = false;
    onboardingConfirmedRef.current = false;
    setHasCompletedOnboarding(false);
    setOnboardingStep(1);
    if (user) {
      await supabase
        .from("profiles")
        .upsert({ user_id: user.id, onboarding_completed: false, onboarding_step: 1 }, { onConflict: "user_id" });
      void supabase.auth.updateUser({ data: { onboarding_completed: false } })
        .catch((e) => console.warn("[AUTH] updateUser onboarding flag failed:", e));
    }
  }

  async function updateOnboardingStep(step: number) {
    setOnboardingStep(step);
    if (!user) return;
    const userId = user.id;
    // Serialize writes so two debounced updates can't land in the DB out of order
    // (which would make the next launch resume one slide off).
    const run = async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ onboarding_step: step })
        .eq("user_id", userId);
      if (error) console.error("[AUTH] updateOnboardingStep failed:", error);
    };
    stepWriteChainRef.current = stepWriteChainRef.current.then(run, run);
  }

  function updateNotifications(n: NotificationSettings) {
    const prev = notifications;
    setNotifications(n);
    try {
      localStorage.setItem("notifications", JSON.stringify(n));
    } catch (e) {
      console.warn("[AppContext] Could not persist 'notifications' to storage:", e);
    }
    if (user) {
      const onPrefSyncFailed = (msg: string) => {
        console.error("Failed to sync notification prefs:", msg);
        analytics.error("notification_prefs_sync_failed", msg, { userId: user.id });
        toast.error("Couldn't save that — your notification settings may not have changed.");
        // Roll the toggles back to the last persisted state so dispatch-notifications'
        // behaviour and the UI agree. defaultTone lives only in localStorage — keep it.
        setNotifications({ ...prev, defaultTone: n.defaultTone });
      };
      supabase.from("notification_preferences").upsert({
        user_id: user.id,
        enabled: n.autoChase,
        email_enabled: n.emailNotifications,
        push_enabled: n.autoChase,
        default_tone: n.defaultTone,
        timezone: getUserTimezone(),
      }, { onConflict: "user_id" }).then(
        ({ error }) => { if (error) onPrefSyncFailed(error.message); },
        (e) => onPrefSyncFailed(e instanceof Error ? e.message : String(e)),
      );
    }
  }

  async function updateDisplayName(name: string | null) {
    const trimmed = name?.trim() ? toTitleCase(name.trim()) : null;
    const prev = fullName;
    setFullName(trimmed);
    if (!user) return;
    try {
      const { error } = await supabase.from("profiles").update({ full_name: trimmed }).eq("user_id", user.id);
      if (error) throw error;
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? String(e);
      console.error("[AppContext] updateDisplayName failed:", e);
      analytics.error("update_display_name_failed", msg, { userId: user.id });
      toast.error("Couldn't save your name — try again.");
      setFullName(prev);
    }
  }

  const userProfile: UserProfile = {
    ...userProfileLocal,
    tone: notifications.defaultTone,
    displayName: fullName ?? undefined,
  };

  return (
    <AppContext.Provider value={{ isAuthenticated, authReady, profileReady, isDemo: false, user, fullName, hasCompletedOnboarding, tourCompleted, dismissedHints, onboardingStep, notifications, invoices, invoicesLoading, invoicesError, refetchInvoices, flushedInvoiceId, userProfile, refreshUserProfile, signIn, signOut, completeOnboarding, restartOnboarding, updateOnboardingStep, updateNotifications, updateDisplayName }}>
      {children}
    </AppContext.Provider>
  );
}

export function AppProvider({ children }: { children: ReactNode }) {
  const isDemo = typeof window !== "undefined" && localStorage.getItem("chasehq_demo_mode") === "1";
  return isDemo
    ? <AppProviderDemo>{children}</AppProviderDemo>
    : <AppProviderReal>{children}</AppProviderReal>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
