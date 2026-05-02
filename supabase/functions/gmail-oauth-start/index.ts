import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { buildCors } from "../_shared/cors.ts";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "../_shared/rate_limit.ts";
import { signState, REDIRECT_ALLOWLIST } from "../_shared/oauth_state.ts";
import { logError } from "../_shared/log.ts";

serve(async (req) => {
  const cors = buildCors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      logError("Auth failed:", authError);
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Per-user rate limit. The gate is auth, so per-user is the right key —
    // even with stolen JWT, an attacker can't enumerate OAuth URLs at scale.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const rl = await checkRateLimit(admin, user.id, "gmail-oauth-start", 30);
    if (!rl.allowed) return rateLimitedResponse(cors);

    const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
    const stateSecret = Deno.env.get("OAUTH_STATE_SECRET");
    if (!clientId) {
      return new Response(JSON.stringify({ error: "Google OAuth not configured" }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    if (!stateSecret) {
      logError("OAUTH_STATE_SECRET not set — refusing to mint forgeable state");
      return new Response(JSON.stringify({ error: "OAuth not fully configured" }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const requestedRedirect = typeof body?.redirectUri === "string" ? body.redirectUri : "";
    // Reject any client-supplied redirectUri not on the server-side allowlist.
    // This prevents an attacker from steering the OAuth callback into an
    // arbitrary URL (open redirect) or third-party origin.
    const redirectUri = REDIRECT_ALLOWLIST.includes(requestedRedirect) ? requestedRedirect : "";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const callbackUrl = `${supabaseUrl}/functions/v1/gmail-oauth-callback`;

    const state = await signState(
      { userId: user.id, redirectUri, nonce: crypto.randomUUID(), iat: Date.now() },
      stateSecret,
    );

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email",
      access_type: "offline",
      prompt: "consent",
      state,
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return new Response(JSON.stringify({ url: authUrl }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    logError("gmail-oauth-start error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
