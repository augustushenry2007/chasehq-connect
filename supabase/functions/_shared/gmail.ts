// Shared Gmail access-token resolver: reads the user's gmail_connections row,
// decrypts the access token from Vault, and refreshes it via Google's OAuth
// token endpoint if it's expired (or within 60s of expiry). Used by send-email
// (to actually send) and gmail-verify (to confirm the connection still works).
//
// On any failure that the user can only fix by re-linking Gmail — no connection
// row, no refresh token, refresh rejected — returns { error: "reauth_required" }.
// Callers translate that into their own user-facing message / response shape.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logError } from "./log.ts";

export type GmailTokenResult =
  | { token: string; email: string }
  | { error: "reauth_required" };

export async function getValidGmailAccessToken(
  admin: SupabaseClient,
  userId: string,
): Promise<GmailTokenResult> {
  const { data: conn } = await admin
    .from("gmail_connections")
    .select("email, access_token_secret_id, refresh_token_secret_id, token_expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!conn) {
    logError("[gmail] no gmail_connections row for user:", userId);
    return { error: "reauth_required" };
  }

  const { data: accessTokenPlain } = await admin
    .rpc("vault_read_secret", { p_id: conn.access_token_secret_id });
  let accessToken: string | null = accessTokenPlain ?? null;
  const expiresMs = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;

  if (!accessToken || Date.now() >= expiresMs - 60_000) {
    const { data: refreshTokenPlain } = await admin
      .rpc("vault_read_secret", { p_id: conn.refresh_token_secret_id });
    if (!refreshTokenPlain) {
      return { error: "reauth_required" };
    }
    const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!,
        client_secret: Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!,
        refresh_token: refreshTokenPlain,
        grant_type: "refresh_token",
      }),
    });
    const refreshData = await refreshRes.json();
    if (!refreshRes.ok || !refreshData.access_token) {
      logError("[gmail] token refresh failed:", refreshRes.status, refreshData);
      return { error: "reauth_required" };
    }
    accessToken = refreshData.access_token as string;
    const newExpires = new Date(Date.now() + (refreshData.expires_in || 3600) * 1000).toISOString();
    await admin.rpc("vault_update_secret", {
      p_id: conn.access_token_secret_id,
      p_value: accessToken,
    });
    await admin
      .from("gmail_connections")
      .update({ token_expires_at: newExpires })
      .eq("user_id", userId);
  }

  return { token: accessToken!, email: conn.email as string };
}
