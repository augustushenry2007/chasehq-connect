import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { verifyState, REDIRECT_ALLOWLIST } from "../_shared/oauth_state.ts";
import { logError, truncate } from "../_shared/log.ts";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      return redirectSafe("", false, "Google authorization was denied");
    }

    if (!code || !stateParam) {
      return redirectSafe("", false, "Missing authorization code");
    }

    // === Verify the state HMAC ===
    // The old implementation parsed `state` as base64-JSON with no signature,
    // which let an attacker craft a state with any userId and bind a victim's
    // tokens to the attacker's account (or vice versa). Now we sign + verify
    // with HMAC-SHA-256, enforce a 10-minute max age (replay protection),
    // and reject any redirectUri not on the server-side allowlist.
    const stateSecret = Deno.env.get("OAUTH_STATE_SECRET");
    if (!stateSecret) {
      logError("OAUTH_STATE_SECRET not set");
      return redirectSafe("", false, "OAuth not fully configured");
    }
    const state = await verifyState(stateParam, stateSecret, {
      maxAgeMs: 10 * 60 * 1000,
      redirectAllowlist: REDIRECT_ALLOWLIST,
    });
    if (!state) {
      return redirectSafe("", false, "Invalid or expired state");
    }

    const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const callbackUrl = `${supabaseUrl}/functions/v1/gmail-oauth-callback`;

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      logError("Token exchange failed:", truncate(JSON.stringify(tokenData)));
      return redirectSafe(state.redirectUri, false, "Token exchange failed");
    }

    // Get user's Gmail email
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();
    const gmailEmail = profile.email || "unknown";

    // Calculate expiry
    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();

    // Store in DB using service role
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: dbError } = await supabase
      .from("gmail_connections")
      .upsert({
        user_id: state.userId,
        email: gmailEmail,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: expiresAt,
      }, { onConflict: "user_id" });

    if (dbError) {
      logError("DB error storing gmail connection:", dbError);
      return redirectSafe(state.redirectUri, false, "Failed to save connection");
    }

    // Mark profile sender_type as gmail (overwrite 'none', preserve explicit 'smtp' choice)
    await supabase
      .from("profiles")
      .update({ sender_type: "gmail" })
      .eq("user_id", state.userId)
      .in("sender_type", ["none", "gmail"]);

    return redirectSafe(state.redirectUri, true);
  } catch (e) {
    logError("gmail-oauth-callback error:", e);
    return new Response(`Error: ${e instanceof Error ? e.message : "Unknown"}`, { status: 500 });
  }
});

// Only redirect to URIs on the server-side allowlist. Any other value falls
// through to "/" so a forged or malformed state can never produce an open
// redirect even if it slipped past verifyState() somehow.
function redirectSafe(redirectUri: string, success: boolean, errorMsg?: string): Response {
  const safeBase = REDIRECT_ALLOWLIST.includes(redirectUri) ? redirectUri : "/";
  const param = success ? "gmail_connected=true" : "gmail_error=" + encodeURIComponent(errorMsg || "Unknown error");
  const finalUrl = safeBase.includes("?") ? `${safeBase}&${param}` : `${safeBase}?${param}`;
  return new Response(null, { status: 302, headers: { Location: finalUrl } });
}
