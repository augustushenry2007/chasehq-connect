import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/context/AppContext";
import type { Tables } from "@/integrations/supabase/types";

type SubRow = Tables<"subscriptions">;

export interface Entitlement {
  loading: boolean;
  status: SubRow["status"];
  plan: string;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  daysLeftInTrial: number | null;
  nextBillingDate: Date | null;
  canSend: boolean;
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
  isTrialing: false,
  isActive: false,
  isPastDue: false,
  refetch: async () => {},
};

function deriveCanSend(row: SubRow | null): boolean {
  if (!row) return false;
  const now = Date.now();
  if (row.status === "trialing" && row.trial_ends_at && new Date(row.trial_ends_at).getTime() > now) return true;
  if (row.status === "active") return !row.current_period_end || new Date(row.current_period_end).getTime() > now;
  if (row.status === "past_due" && row.current_period_end && new Date(row.current_period_end).getTime() > now) return true;
  return false;
}

export function useEntitlement(): Entitlement {
  const { user, authReady } = useApp();
  const [row, setRow] = useState<SubRow | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRow = useCallback(async () => {
    if (!user) {
      setRow(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    setRow(data ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!authReady) return;
    setLoading(true);
    fetchRow();
    if (!user) return;
    const channel = supabase
      .channel(`sub-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${user.id}` },
        () => fetchRow()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, authReady, fetchRow]);

  if (!user || !row) {
    return { ...DEFAULT, loading: loading || !authReady, refetch: fetchRow };
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
    canSend: deriveCanSend(row),
    isTrialing: row.status === "trialing",
    isActive: row.status === "active",
    isPastDue: row.status === "past_due",
    refetch: fetchRow,
  };
}
