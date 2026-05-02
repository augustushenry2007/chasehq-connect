// DEPRECATED: trial starts now go through Apple StoreKit via validate-apple-receipt.
// This function is kept for emergency manual grants only; the client no longer calls it.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { buildCors } from "../_shared/cors.ts";

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
  const cors = buildCors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

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

    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 86400_000).toISOString();
    const nowIso = new Date().toISOString();

    // Atomic: UPDATE only when status = 'none' — prevents race-condition double-start.
    // Two concurrent calls both read status='none'; only one UPDATE wins; the other
    // finds 0 rows updated and falls through to the INSERT, which also loses to the
    // unique constraint, landing it in the already-started branch.
    const { data: updated } = await admin
      .from("subscriptions")
      .update({ status: "trialing", plan: "chasehq_pro_monthly", trial_ends_at: trialEndsAt, last_event_at: nowIso })
      .eq("user_id", userId)
      .eq("status", "none")
      .select()
      .maybeSingle();

    if (updated) {
      await admin.from("subscription_events").insert({
        user_id: userId,
        event_type: "trial_started",
        payload: { trial_ends_at: trialEndsAt, plan: "chasehq_pro_monthly" },
      });
      return json({ ok: true, status: "trialing", trial_ends_at: trialEndsAt });
    }

    // No row to update — either already non-none, or no row exists yet. Try INSERT.
    const { error: insertErr } = await admin.from("subscriptions").insert({
      user_id: userId,
      status: "trialing",
      plan: "chasehq_pro_monthly",
      trial_ends_at: trialEndsAt,
      last_event_at: nowIso,
    });

    if (insertErr) {
      if (insertErr.code === "23505") {
        // Unique violation: row exists with status != 'none' — already started.
        const { data: existing } = await admin
          .from("subscriptions")
          .select("status, trial_ends_at")
          .eq("user_id", userId)
          .maybeSingle();
        return json({ ok: true, already: true, status: existing?.status, trial_ends_at: existing?.trial_ends_at });
      }
      console.error("start-trial insert error:", insertErr);
      return json({ error: insertErr.message || "Could not start trial" }, 500);
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

