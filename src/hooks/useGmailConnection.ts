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
      toast.error("Gmail connection failed", {
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
    const { data, error } = await supabase.functions.invoke("gmail-oauth-start", {
      body: { redirectUri: window.location.origin + path },
      headers: { Authorization: `Bearer ${token}` },
    });
    if (error || (data as any)?.error) {
      const msg = error?.message || (data as any)?.error || "Failed to start Gmail OAuth";
      console.error("connectGmail error:", msg, error, data);
      return { error: msg };
    }
    if ((data as any)?.url) {
      window.location.href = (data as any).url;
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
