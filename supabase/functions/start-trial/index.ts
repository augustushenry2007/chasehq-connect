// DEPRECATED: trial starts now go through Apple StoreKit via validate-apple-receipt.
// This function is kept for emergency manual grants only; the client no longer calls it.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-user-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TRIAL_DAYS = 14;

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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // X-User-Token carries the real ES256 user JWT (same bypass as send-email).
    const userToken = req.headers.get("X-User-Token") ??
      req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!userToken) return json({ error: "Not authenticated" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userId = await verifySupabaseJWT(userToken, supabaseUrl);
    if (!userId) return json({ error: "Invalid session" }, 401);

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(userId);
    if (authErr || !authUser.user) return json({ error: "Invalid session" }, 401);

    const { data: existing } = await admin
      .from("subscriptions").select("*").eq("user_id", userId).maybeSingle();

    if (existing && existing.status !== "none") {
      return json({
        ok: true,
        already: true,
        status: existing.status,
        trial_ends_at: existing.trial_ends_at,
      });
    }

    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 86400_000).toISOString();
    const nowIso = new Date().toISOString();

    const upsert = await admin.from("subscriptions").upsert({
      user_id: userId,
      status: "trialing",
      plan: "chasehq_pro_monthly",
      trial_ends_at: trialEndsAt,
      last_event_at: nowIso,
    }, { onConflict: "user_id" }).select().maybeSingle();

    if (upsert.error) {
      console.error("start-trial upsert error:", upsert.error);
      return json({ error: upsert.error.message || "Could not start trial" }, 500);
    }

    await admin.from("subscription_events").insert({
      user_id: userId,
      event_type: "trial_started",
      payload: { trial_ends_at: trialEndsAt, plan: "chasehq_pro_monthly" },
    });

    return json({ ok: true, status: "trialing", trial_ends_at: trialEndsAt });
  } catch (e) {
    console.error("start-trial error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
