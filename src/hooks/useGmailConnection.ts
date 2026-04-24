import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/context/AppContext";
import { toast } from "sonner";

export interface GmailConnection {
  email: string;
  connected: boolean;
}

export function useGmailConnection() {
  const { user } = useApp();
  const [gmail, setGmail] = useState<GmailConnection>({ email: "", connected: false });
  const [loading, setLoading] = useState(true);

  // Did the user sign in via Google? If so, they only need to grant Gmail send
  // permission — they don't need to "connect a separate account".
  const signedInWithGoogle = useMemo(() => {
    if (!user) return false;
    const provider = (user.app_metadata as any)?.provider;
    const providers = (user.app_metadata as any)?.providers as string[] | undefined;
    return provider === "google" || (providers?.includes("google") ?? false);
  }, [user]);

  const googleEmail = user?.email || "";

  const fetchConnection = useCallback(async () => {
    if (!user) {
      setGmail({ email: "", connected: false });
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("gmail_connections")
      .select("email")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data && !error) {
      setGmail({ email: data.email, connected: true });
    } else {
      setGmail({ email: "", connected: false });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchConnection();
  }, [fetchConnection]);

  // Refetch when gmail_connections row is inserted/updated (e.g. tokens captured
  // from provider_token during Google signup) so the "Connect Gmail" dialog
  // disappears without requiring a page reload.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`gmail-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "gmail_connections", filter: `user_id=eq.${user.id}` },
        () => fetchConnection()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchConnection]);

  // Check URL params for gmail_connected / gmail_error callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const url = new URL(window.location.href);
    if (params.get("gmail_connected") === "true") {
      fetchConnection();
      url.searchParams.delete("gmail_connected");
      window.history.replaceState({}, "", url.toString());
    }
    const err = params.get("gmail_error");
    if (err) {
      toast.error("We couldn't reach Gmail. Sign in once more and we'll pick it up from there.", {
        description: err === "redirect_uri_mismatch"
          ? "The OAuth redirect URI isn't whitelisted. Add the callback URL in Google Cloud Console."
          : decodeURIComponent(err),
      });
      url.searchParams.delete("gmail_error");
      window.history.replaceState({}, "", url.toString());
    }
  }, [fetchConnection]);

  async function connectGmail(redirectPath?: string) {
    const path = redirectPath || window.location.pathname || "/dashboard";
    // Ensure we have a fresh session token — invoke() doesn't always attach it.
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      return { error: "Please sign in first to connect Gmail." };
    }
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const res = await fetch(`${supabaseUrl}/functions/v1/gmail-oauth-start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ redirectUri: window.location.origin + path }),
    });
    const data = await res.json();
    if (!res.ok || data?.error) {
      const msg = data?.error || `Gmail OAuth failed (${res.status})`;
      console.error("connectGmail error:", msg, data);
      return { error: msg };
    }
    if (data?.url) {
      window.location.href = data.url;
    }
    return {};
  }

  async function disconnectGmail() {
    if (!user) return;
    await supabase
      .from("gmail_connections")
      .delete()
      .eq("user_id", user.id);
    setGmail({ email: "", connected: false });
  }

  return {
    gmail,
    loading,
    connectGmail,
    disconnectGmail,
    refetch: fetchConnection,
    signedInWithGoogle,
    googleEmail,
    // True only when sending permission has actually been granted.
    canSend: gmail.connected,
    // True when permission still needs to be granted.
    needsSendPermission: !gmail.connected,
  };
}
