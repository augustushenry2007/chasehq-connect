import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { buildCors } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitedResponse } from "../_shared/rate_limit.ts";
import { logError } from "../_shared/log.ts";

serve(async (req) => {
  const cors = buildCors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Not authenticated" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    // Verify the user's session using their JWT.
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return json({ error: "Invalid session" }, 401);
    }

    const admin = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const rl = await checkRateLimit(admin, user.id, "gmail-link-from-auth-code", 10);
    if (!rl.allowed) return rateLimitedResponse(cors);

    const body = await req.json().catch(() => ({}));
    const serverAuthCode = typeof body?.serverAuthCode === "string" ? body.serverAuthCode : "";
    if (!serverAuthCode) return json({ error: "Missing serverAuthCode" }, 400);

    // Exchange the one-time auth code for tokens.
    // For native GIDSignIn codes the redirect_uri must be an empty string.
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!,
        client_secret: Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!,
        code: serverAuthCode,
        redirect_uri: "",
        grant_type: "authorization_code",
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      logError("gmail-link-from-auth-code token exchange failed:", tokenRes.status, JSON.stringify(tokenData));
      return json({ error: "token_exchange_failed", message: "Could not link Gmail. Please try reconnecting from Settings." }, 502);
    }

    // Fetch the Gmail address associated with this token.
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();
    const gmailEmail = typeof profile.email === "string" && profile.email ? profile.email : (user.email ?? "unknown");

    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();

    const { error: dbError } = await admin.rpc("upsert_gmail_connection", {
      p_user_id:          user.id,
      p_email:            gmailEmail,
      p_access_token:     tokenData.access_token,
      p_refresh_token:    tokenData.refresh_token ?? null,
      p_token_expires_at: expiresAt,
    });
    if (dbError) {
      logError("gmail-link-from-auth-code DB error:", dbError);
      return json({ error: "db_error", message: "Could not save Gmail link. Please try again." }, 500);
    }

    // Upsert profiles.sender_type — works whether the profile row exists yet or not.
    // New Google sign-ups may not have a profiles row at this point (it's created
    // by an async DB trigger), so .update() would silently match 0 rows.
    const { error: profErr } = await admin
      .from("profiles")
      .upsert({ user_id: user.id, sender_type: "gmail" }, { onConflict: "user_id" });
    if (profErr) {
      logError("gmail-link-from-auth-code profile upsert failed:", profErr);
      return json({ error: "profile_update_failed", message: profErr.message }, 500);
    }

    // Read back to confirm — if PostgREST silently no-ops (e.g. an UPDATE trigger
    // resets sender_type, or a CHECK rejects 'gmail'), surface that instead of
    // returning misleading success.
    const { data: confirm, error: confirmErr } = await admin
      .from("profiles")
      .select("sender_type")
      .eq("user_id", user.id)
      .maybeSingle();
    if (confirmErr) {
      logError("gmail-link-from-auth-code profile readback failed:", confirmErr);
    }
    if (confirm?.sender_type !== "gmail") {
      logError("gmail-link-from-auth-code sender_type not 'gmail' after upsert:", confirm?.sender_type);
      return json({ error: "profile_update_silent_failure", actual: confirm?.sender_type ?? null }, 500);
    }

    return json({ success: true, email: gmailEmail });
  } catch (e) {
    logError("gmail-link-from-auth-code error:", e);
    return json({ error: "Internal error" }, 500);
  }
});
