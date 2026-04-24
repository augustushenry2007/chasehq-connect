import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/context/AppContext";

export type SenderType = "gmail" | "smtp" | "none";

export interface SmtpConnectionSafe {
  user_id: string;
  from_email: string;
  from_name: string | null;
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  verified: boolean;
}

export function useSendingMailbox() {
  const { user } = useApp();
  const [hasGmail, setHasGmail] = useState(false);
  const [smtp, setSmtp] = useState<SmtpConnectionSafe | null>(null);
  const [activeSender, setActiveSenderState] = useState<SenderType>("none");
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) {
      setHasGmail(false);
      setSmtp(null);
      setActiveSenderState("none");
      setLoading(false);
      return;
    }
    const [gmailRes, smtpRes, profileRes] = await Promise.all([
      supabase.from("gmail_connections").select("user_id").eq("user_id", user.id).maybeSingle(),
      (supabase as any).from("smtp_connections_safe").select("*").eq("user_id", user.id).maybeSingle(),
      (supabase as any).from("profiles").select("sender_type").eq("user_id", user.id).maybeSingle(),
    ]);
    const gmail = !!gmailRes.data;
    const smtpRow = (smtpRes.data as SmtpConnectionSafe | null) ?? null;
    setHasGmail(gmail);
    setSmtp(smtpRow);
    const stored = (profileRes.data as any)?.sender_type as SenderType | undefined;
    let resolved: SenderType = stored ?? "none";
    if (resolved === "gmail" && !gmail) resolved = smtpRow ? "smtp" : "none";
    if (resolved === "smtp" && !smtpRow) resolved = gmail ? "gmail" : "none";
    if (resolved === "none" && (gmail || smtpRow)) resolved = gmail ? "gmail" : "smtp";
    setActiveSenderState(resolved);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Refetch when the user's gmail_connections row is inserted/updated
  // (e.g. tokens captured from provider_token during merged-OAuth signup)
  // so the dashboard "Connect Gmail" dialog disappears without a reload.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`sending-mailbox-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "gmail_connections", filter: `user_id=eq.${user.id}` },
        () => refetch()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, refetch]);

  const setActiveSender = useCallback(async (next: SenderType) => {
    if (!user) return;
    setActiveSenderState(next);
    await (supabase as any)
      .from("profiles")
      .update({ sender_type: next })
      .eq("user_id", user.id);
  }, [user]);

  return {
    loading,
    hasGmail,
    hasSmtp: !!smtp,
    smtp,
    activeSender,
    canSend: activeSender !== "none",
    setActiveSender,
    refetch,
  };
}
