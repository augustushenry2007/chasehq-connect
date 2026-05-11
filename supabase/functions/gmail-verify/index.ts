// "Is the connected Gmail still usable?" — the client's gmail_connections row
// only proves a link was *made*, not that it still works (the user can revoke
// the app in their Google account, or the refresh token can die). This endpoint
// resolves a valid access token (refreshing if needed) and pings the Gmail
// profile API so the UI can show "Reconnect Gmail" before a send attempt fails.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { buildCors } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitedResponse } from "../_shared/rate_limit.ts";
import { logError } from "../_shared/log.ts";
import { getValidGmailAccessToken } from "../_shared/gmail.ts";

// Verifies a Supabase JWT locally — handles both legacy HS256 and new ES256 (ECC P-256) keys.
async function verifySupabaseJWT(token: string, supabaseUrl: string): Promise<string | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const decode = (s: string) =>
      JSON.parse(new TextDecoder().decode(
        Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0))
      ));
    const header = decode(parts[0]);
    const payload = decode(parts[1]);
    if (!payload.sub) return null;
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;

    const signingInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const sig = Uint8Array.from(atob(parts[2].replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));

    if (header.alg === "HS256") {
      const secret = Deno.env.get("SUPABASE_JWT_SECRET");
      if (!secret) return null;
      const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
      if (!await crypto.subtle.verify("HMAC", key, sig, signingInput)) return null;
    } else if (header.alg === "ES256") {
      const jwksRes = await fetch(`${supabaseUrl}/auth/v1/.well-known/jwks.json`);
      if (!jwksRes.ok) return null;
      const { keys } = await jwksRes.json();
      const jwk = keys.find((k: any) => !header.kid || k.kid === header.kid) ?? keys[0];
      if (!jwk) return null;
      const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
      if (!await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, sig, signingInput)) return null;
    } else {
      return null;
    }
    return payload.sub as string;
  } catch {
    return null;
  }
}

serve(async (req) => {
  const cors = buildCors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const userToken = req.headers.get("X-User-Token") ??
      req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!userToken) return json({ error: "Not authenticated" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userId = await verifySupabaseJWT(userToken, supabaseUrl);
    if (!userId) return json({ error: "Invalid session" }, 401);

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const rl = await checkRateLimit(admin, userId, "gmail-verify", 20);
    if (!rl.allowed) return rateLimitedResponse(cors);

    const { data: conn } = await admin
      .from("gmail_connections")
      .select("email")
      .eq("user_id", userId)
      .maybeSingle();
    if (!conn) return json({ connected: false });

    const auth = await getValidGmailAccessToken(admin, userId);
    if ("error" in auth) return json({ ok: false, connected: false, reason: "reauth_required", email: conn.email });

    let profileRes: Response;
    try {
      profileRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
    } catch (e) {
      // Network blip talking to Google — don't downgrade the connection over a
      // transient error; report it as still OK (a real revocation surfaces above).
      logError("[gmail-verify] profile fetch threw:", e instanceof Error ? e.message : String(e));
      return json({ ok: true, connected: true, email: auth.email });
    }
    if (profileRes.ok) {
      const profile = await profileRes.json().catch(() => null);
      return json({ ok: true, connected: true, email: profile?.emailAddress ?? auth.email });
    }
    if (profileRes.status === 401 || profileRes.status === 403) {
      return json({ ok: false, connected: false, reason: "reauth_required", email: auth.email });
    }
    logError("[gmail-verify] unexpected Gmail profile status:", profileRes.status);
    return json({ ok: true, connected: true, email: auth.email });
  } catch (e) {
    logError("gmail-verify error:", e);
    return json({ error: "Internal error" }, 500);
  }
});
