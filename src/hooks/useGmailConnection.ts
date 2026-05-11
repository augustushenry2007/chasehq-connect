import { useState, useEffect, useCallback, useMemo } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/context/AppContext";
import { toast } from "sonner";
import { analytics } from "@/integrations/analytics";

export interface GmailConnection {
  email: string;
  connected: boolean;
  // True when a gmail_connections row exists but the token is dead (user revoked
  // the app in Google, refresh token expired). We keep the email so the UI can
  // say "Reconnect Gmail (you@gmail.com)" rather than a misleading green check.
  needsReauth: boolean;
}

export function useGmailConnection() {
  const { user } = useApp();
  const [gmail, setGmail] = useState<GmailConnection>({ email: "", connected: false, needsReauth: false });
  const [loading, setLoading] = useState(true);

  // Did the user sign in via Google? If so, they only need to grant Gmail send
  // permission — they don't need to "connect a separate account".
  const signedInWithGoogle = useMemo(() => {
    if (!user) return false;
    const provider = (user.app_metadata as any)?.provider;
    const providers = (user.app_metadata as any)?.providers as string[] | undefined;
    return provider === "google" || (providers?.includes("google") ?? false);
  }, [user?.id]);

  const googleEmail = user?.email || "";

  const fetchConnection = useCallback(async () => {
    if (!user) {
      setGmail({ email: "", connected: false, needsReauth: false });
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("gmail_connections")
        .select("email")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) {
        console.error("[useGmailConnection] fetch error:", error);
        analytics.error("gmail_connection_fetch_error", error.message, { userId: user.id });
        // Leave whatever we last knew; don't flip a connected user to disconnected
        // just because one read failed.
      } else {
        setGmail(data ? { email: data.email, connected: true, needsReauth: false } : { email: "", connected: false, needsReauth: false });
      }
    } catch (e) {
      // iOS/WKWebView transport errors reject rather than returning {error};
      // without clearing `loading` here handleSendClick early-returns forever.
      console.error("[useGmailConnection] fetch threw:", e);
      analytics.error("gmail_connection_fetch_exception", e instanceof Error ? e.message : String(e), { userId: user.id });
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Token validity check: a gmail_connections row only proves a link was made,
  // not that the token still works. Calls gmail-verify (which refreshes the
  // token and pings the Gmail profile API). Background-only — never blocks render
  // — and never deletes the DB row; on a dead token it flips the UI to
  // needsReauth so the user gets "Reconnect Gmail" instead of a false green check.
  const verify = useCallback(async () => {
    if (!user) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userToken = session?.access_token;
      if (!userToken) return;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/gmail-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${anonKey}`, "X-User-Token": userToken },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => null);
      if (!data) return;
      if (data.connected === true) {
        setGmail({ email: data.email ?? "", connected: true, needsReauth: false });
      } else if (data.connected === false && data.reason === "reauth_required") {
        setGmail({ email: data.email ?? "", connected: false, needsReauth: true });
      }
      // data.connected === false with no reason → genuinely no row; fetchConnection already reflects that.
    } catch (e) {
      // Transient (network blip / WKWebView reject) — don't downgrade a connected user.
      console.warn("[useGmailConnection] verify failed:", e);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchConnection();
  }, [fetchConnection]);

  // Once we know the DB row says "connected", verify the token actually works.
  useEffect(() => {
    if (loading || !user || !gmail.connected) return;
    verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, loading, gmail.connected]);

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
  }, [user?.id, fetchConnection]);

  // Check URL params for gmail_connected / gmail_error callback (web) and
  // listen for custom events dispatched by appUrlOpen (native iOS).
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

    const onConnected = () => fetchConnection();
    const onError = (e: Event) => {
      const msg = (e as CustomEvent<string>).detail;
      toast.error("We couldn't reach Gmail. Sign in once more and we'll pick it up from there.", {
        description: msg ? decodeURIComponent(msg) : undefined,
      });
    };
    window.addEventListener("chasehq:gmail-connected", onConnected);
    window.addEventListener("chasehq:gmail-error", onError);
    return () => {
      window.removeEventListener("chasehq:gmail-connected", onConnected);
      window.removeEventListener("chasehq:gmail-error", onError);
    };
  }, [fetchConnection]);

  async function connectGmail() {
    const isNative = Capacitor.isNativePlatform();
    // Web: just the origin (always in allowlist). Native: registered custom scheme.
    const redirectUri = isNative ? "com.chasehq.app://gmail-oauth" : window.location.origin;

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
      body: JSON.stringify({ redirectUri, loginHint: user?.email ?? undefined }),
    });
    const data = await res.json();
    if (!res.ok || data?.error) {
      const msg = data?.error || `Gmail OAuth failed (${res.status})`;
      console.error("connectGmail error:", msg, data);
      return { error: msg };
    }
    if (data?.url) {
      if (isNative) {
        const { Browser } = await import("@capacitor/browser");
        await Browser.open({ url: data.url });
      } else {
        window.location.href = data.url;
      }
    }
    return {};
  }

  async function disconnectGmail() {
    if (!user) return;
    await supabase
      .from("gmail_connections")
      .delete()
      .eq("user_id", user.id);
    setGmail({ email: "", connected: false, needsReauth: false });
  }

  return {
    gmail,
    loading,
    connectGmail,
    disconnectGmail,
    refetch: fetchConnection,
    verify,
    signedInWithGoogle,
    googleEmail,
    // True only when sending permission has actually been granted *and* the token works.
    canSend: gmail.connected,
    // True when permission still needs to be granted (never connected, or token died).
    needsSendPermission: !gmail.connected,
    // Distinguishes "you revoked us / token expired" from "never connected".
    needsReauth: gmail.needsReauth,
  };
}
