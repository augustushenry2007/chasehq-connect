import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/context/AppContext";

export interface GmailConnection {
  email: string;
  connected: boolean;
}

export function useGmailConnection() {
  const { user } = useApp();
  const [gmail, setGmail] = useState<GmailConnection>({ email: "", connected: false });
  const [loading, setLoading] = useState(true);

  const fetchConnection = useCallback(async () => {
    if (!user) {
      setGmail({ email: "", connected: false });
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("gmail_connections" as any)
      .select("email")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data && !error) {
      setGmail({ email: (data as any).email, connected: true });
    } else {
      setGmail({ email: "", connected: false });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchConnection();
  }, [fetchConnection]);

  // Check URL params for gmail_connected callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("gmail_connected") === "true") {
      fetchConnection();
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete("gmail_connected");
      window.history.replaceState({}, "", url.toString());
    }
  }, [fetchConnection]);

  async function connectGmail(redirectPath?: string) {
    const path = redirectPath || window.location.pathname || "/dashboard";
    const { data, error } = await supabase.functions.invoke("gmail-oauth-start", {
      body: { redirectUri: window.location.origin + path },
    });
    if (error || data?.error) {
      return { error: error?.message || data?.error || "Failed to start Gmail OAuth" };
    }
    if (data?.url) {
      window.location.href = data.url;
    }
    return {};
  }

  async function disconnectGmail() {
    if (!user) return;
    await supabase
      .from("gmail_connections" as any)
      .delete()
      .eq("user_id", user.id);
    setGmail({ email: "", connected: false });
  }

  return { gmail, loading, connectGmail, disconnectGmail, refetch: fetchConnection };
}
