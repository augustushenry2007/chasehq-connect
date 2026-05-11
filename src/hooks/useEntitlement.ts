import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/context/AppContext";
import type { Tables } from "@/integrations/supabase/types";
import { getActiveEntitlement } from "@/integrations/iap";
import { analytics } from "@/integrations/analytics";

type SubRow = Tables<"subscriptions">;

// Module-level counter so every call to useEntitlement() — regardless of which
// component instance — gets a unique channel name and never hits an already-subscribed channel.
let _subSeq = 0;

export interface Entitlement {
  loading: boolean;
  status: SubRow["status"];
  plan: string;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  daysLeftInTrial: number | null;
  nextBillingDate: Date | null;
  canSend: boolean;
  hasFreeSend: boolean;
  followupsSent: number | null;
  isTrialing: boolean;
  isActive: boolean;
  isPastDue: boolean;
  refetch: () => Promise<void>;
  noteFollowupSent: () => void;
}

const DEFAULT: Entitlement = {
  loading: true,
  status: "none",
  plan: "chasehq_pro_monthly",
  trialEndsAt: null,
  currentPeriodEnd: null,
  daysLeftInTrial: null,
  nextBillingDate: null,
  canSend: false,
  hasFreeSend: false,
  followupsSent: null,
  isTrialing: false,
  isActive: false,
  isPastDue: false,
  refetch: async () => {},
  noteFollowupSent: () => {},
};

function deriveCanSend(row: SubRow | null): boolean {
  if (!row) return false;
  const now = Date.now();
  if (row.status === "trialing") return !row.trial_ends_at || new Date(row.trial_ends_at).getTime() > now;
  if (row.status === "active") return !row.current_period_end || new Date(row.current_period_end).getTime() > now;
  if (row.status === "past_due" && row.current_period_end && new Date(row.current_period_end).getTime() > now) return true;
  return false;
}

export function useEntitlement(): Entitlement {
  const { user, authReady } = useApp();
  const [row, setRow] = useState<SubRow | null>(null);
  const [subLoading, setSubLoading] = useState(true);
  const [followupsCount, setFollowupsCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(true);
  // Device-side RevenueCat entitlement — the source of truth Apple already verified.
  // Used as a fallback for canSend when the `subscriptions` DB row is missing or
  // stale (e.g. validate-apple-receipt had a brief outage right after a purchase),
  // so a paying user isn't silently blocked while the row catches up. Never gates
  // `loading` (it's a fast local bridge call) and always false on web.
  const [rcEntitled, setRcEntitled] = useState(false);

  // Synchronously reset loading when user identity changes so the post-OAuth
  // recovery effect in AIDraftComposer sees loading=true on the first render
  // after sign-in, preventing it from running with stale gate values.
  const [prevUserId, setPrevUserId] = useState<string | undefined>(user?.id);
  if (prevUserId !== user?.id) {
    setPrevUserId(user?.id);
    setSubLoading(true);
    setCountLoading(true);
    setRcEntitled(false);
  }

  const fetchRow = useCallback(async () => {
    if (!user) {
      setRow(null);
      setSubLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) {
        console.error("[useEntitlement] subscriptions fetch error:", error);
        analytics.error("entitlement_fetch_error", error.message, { userId: user.id });
      } else {
        setRow(data ?? null);
      }
    } catch (e) {
      // iOS/WKWebView transport errors reject rather than returning {error};
      // without clearing subLoading the action gate stays in "loading" forever
      // and the Send/Generate buttons go inert with no feedback.
      console.error("[useEntitlement] subscriptions fetch threw:", e);
      analytics.error("entitlement_fetch_exception", e instanceof Error ? e.message : String(e), { userId: user.id });
    } finally {
      setSubLoading(false);
    }
  }, [user?.id]);

  const fetchRcEntitlement = useCallback(async () => {
    if (!user) { setRcEntitled(false); return; }
    try {
      const ent = await getActiveEntitlement();
      setRcEntitled(!!ent?.entitled);
    } catch {
      // getActiveEntitlement already swallows its own errors; this is belt-and-braces.
      setRcEntitled(false);
    }
  }, [user?.id]);

  const fetchFollowupsCount = useCallback(async () => {
    if (!user) { setFollowupsCount(null); setCountLoading(false); return; }
    try {
      const { count, error } = await supabase
        .from("followups")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      if (error) {
        console.error("[useEntitlement] followups count error:", error);
        analytics.error("followups_count_error", error.message, { userId: user.id });
      } else {
        setFollowupsCount(prev => Math.max(prev ?? 0, count ?? 0));
      }
    } catch (e) {
      console.error("[useEntitlement] followups count threw:", e);
      analytics.error("followups_count_exception", e instanceof Error ? e.message : String(e), { userId: user.id });
    } finally {
      setCountLoading(false);
    }
  }, [user?.id]);

  const refetch = useCallback(async () => {
    await Promise.all([fetchRow(), fetchRcEntitlement()]);
  }, [fetchRow, fetchRcEntitlement]);

  useEffect(() => {
    if (!authReady) return;
    setSubLoading(true);
    setCountLoading(true);
    if (user) {
      try {
        const floor = sessionStorage.getItem(`chase_free_send_used_${user.id}`);
        if (floor === "1") setFollowupsCount(prev => Math.max(prev ?? 0, 1));
      } catch {}
    }
    void fetchRow();
    void fetchRcEntitlement();
    void fetchFollowupsCount();
    if (!user) return;
    const channel = supabase
      .channel(`sub-${user.id}-${_subSeq++}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${user.id}` },
        () => { void fetchRow(); void fetchRcEntitlement(); }
      )
      .subscribe();
    const followupsChannel = supabase
      .channel(`followups-${user.id}-${_subSeq++}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "followups", filter: `user_id=eq.${user.id}` },
        () => { void fetchFollowupsCount(); }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(followupsChannel);
    };
  }, [user?.id, authReady, fetchRow, fetchRcEntitlement, fetchFollowupsCount]);

  const noteFollowupSent = useCallback(() => {
    if (user) {
      try { sessionStorage.setItem(`chase_free_send_used_${user.id}`, "1"); } catch {}
    }
    setFollowupsCount(prev => (prev ?? 0) + 1);
  }, [user?.id]);

  const hasFreeSend = !!user && !countLoading && followupsCount !== null && followupsCount === 0;
  const loading = subLoading || countLoading;

  if (!user) {
    return { ...DEFAULT, loading: loading || !authReady, hasFreeSend: false, refetch, noteFollowupSent };
  }
  if (!row) {
    // No subscription row yet — either the user hasn't subscribed (route through IAP /
    // free send) or validate-apple-receipt hasn't written the row yet after a purchase.
    // rcEntitled covers the latter so a paying user isn't blocked while the row catches up.
    return { ...DEFAULT, loading, canSend: rcEntitled || hasFreeSend, hasFreeSend, followupsSent: followupsCount, refetch, noteFollowupSent };
  }

  const trialEndsAt = row.trial_ends_at ? new Date(row.trial_ends_at) : null;
  const currentPeriodEnd = row.current_period_end ? new Date(row.current_period_end) : null;
  const daysLeftInTrial = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86400000))
    : null;

  return {
    loading: false,
    status: row.status,
    plan: row.plan,
    trialEndsAt,
    currentPeriodEnd,
    daysLeftInTrial,
    nextBillingDate: currentPeriodEnd,
    canSend: deriveCanSend(row) || rcEntitled || hasFreeSend,
    hasFreeSend,
    followupsSent: followupsCount,
    isTrialing: row.status === "trialing",
    isActive: row.status === "active",
    isPastDue: row.status === "past_due",
    refetch,
    noteFollowupSent,
  };
}
