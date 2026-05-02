import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/context/AppContext";
import type { Tables } from "@/integrations/supabase/types";

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

  // Synchronously reset loading when user identity changes so the post-OAuth
  // recovery effect in AIDraftComposer sees loading=true on the first render
  // after sign-in, preventing it from running with stale gate values.
  const [prevUserId, setPrevUserId] = useState<string | undefined>(user?.id);
  if (prevUserId !== user?.id) {
    setPrevUserId(user?.id);
    setSubLoading(true);
    setCountLoading(true);
  }

  const fetchRow = useCallback(async () => {
    if (!user) {
      setRow(null);
      setSubLoading(false);
      return;
    }
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    setRow(data ?? null);
    setSubLoading(false);
  }, [user]);

  const fetchFollowupsCount = useCallback(async () => {
    if (!user) { setFollowupsCount(null); setCountLoading(false); return; }
    const { count } = await supabase
      .from("followups")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    setFollowupsCount(count ?? 0);
    setCountLoading(false);
  }, [user]);

  useEffect(() => {
    if (!authReady) return;
    setSubLoading(true);
    setCountLoading(true);
    void fetchRow();
    void fetchFollowupsCount();
    if (!user) return;
    const channel = supabase
      .channel(`sub-${user.id}-${_subSeq++}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${user.id}` },
        () => { void fetchRow(); }
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
  }, [user, authReady, fetchRow, fetchFollowupsCount]);

  const hasFreeSend = !!user && !countLoading && followupsCount !== null && followupsCount <= 1;
  const loading = subLoading || countLoading;

  if (!user) {
    return { ...DEFAULT, loading: loading || !authReady, hasFreeSend: false, refetch: fetchRow };
  }
  if (!row) {
    // No subscription row = user hasn't subscribed yet; route through IAP or use free send
    return { ...DEFAULT, loading, canSend: hasFreeSend, hasFreeSend, followupsSent: followupsCount, refetch: fetchRow };
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
    canSend: deriveCanSend(row) || hasFreeSend,
    hasFreeSend,
    followupsSent: followupsCount,
    isTrialing: row.status === "trialing",
    isActive: row.status === "active",
    isPastDue: row.status === "past_due",
    refetch: fetchRow,
  };
}
