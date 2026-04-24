import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-user-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Apple verifyReceipt endpoints
const APPLE_PROD = "https://buy.itunes.apple.com/verifyReceipt";
const APPLE_SANDBOX = "https://sandbox.itunes.apple.com/verifyReceipt";

interface ValidatePayload {
  receipt: string;
  productId?: string;
  mock?: boolean;
  restore?: boolean;
}

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
    const userToken = req.headers.get("X-User-Token") ??
      req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!userToken) return json({ error: "Not authenticated" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userId = await verifySupabaseJWT(userToken, supabaseUrl);
    if (!userId) return json({ error: "Invalid session" }, 401);

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(userId);
    if (authErr || !authUser.user) return json({ error: "Invalid session" }, 401);

    const body = await req.json() as ValidatePayload;
    if (!body?.receipt) return json({ error: "Missing receipt" }, 400);

    const { data: existing } = await admin
      .from("subscriptions").select("*").eq("user_id", userId).maybeSingle();

    let status: "trialing" | "active";
    let currentPeriodEnd: string;
    let trialEndsAt: string | null = null;
    let originalTransactionId: string;
    let latestReceipt = body.receipt;
    const wasNew = !existing || existing.status === "none" || !existing.status;

    // === MOCK PATH (web preview / dev) ===
    const sharedSecret = Deno.env.get("APPLE_SHARED_SECRET");
    const useMock = body.mock === true || !sharedSecret;

    if (useMock) {
      // First-time user gets a mock trial; returning users get active (they've used the intro offer).
      const isFirstTime = !existing || existing.status === "none" || !existing.status;
      if (isFirstTime) {
        status = "trialing";
        trialEndsAt = new Date(Date.now() + 14 * 86400_000).toISOString();
        currentPeriodEnd = trialEndsAt;
      } else {
        status = "active";
        currentPeriodEnd = new Date(Date.now() + 30 * 86400_000).toISOString();
      }
      originalTransactionId = `mock_${userId}`;
    } else {
      // === REAL APPLE VALIDATION ===
      const verify = await verifyReceiptWithApple(body.receipt, sharedSecret!);
      if (!verify.ok) return json({ error: verify.error }, 400);

      // Use the most recent transaction (last element, sorted ascending by Apple).
      const latestInfo = verify.payload.latest_receipt_info?.[verify.payload.latest_receipt_info.length - 1]
        ?? verify.payload.latest_receipt_info?.[0]
        ?? verify.payload.receipt?.in_app?.[0];
      if (!latestInfo) return json({ error: "No subscription info in receipt" }, 400);

      const expiresMs = parseInt(latestInfo.expires_date_ms || "0", 10);
      if (!expiresMs) return json({ error: "Receipt missing expiration" }, 400);

      const isTrialing = latestInfo.is_trial_period === "true" || latestInfo.is_in_intro_offer_period === "true";
      status = isTrialing ? "trialing" : "active";
      currentPeriodEnd = new Date(expiresMs).toISOString();
      trialEndsAt = isTrialing ? currentPeriodEnd : null;
      originalTransactionId = latestInfo.original_transaction_id;
      latestReceipt = verify.payload.latest_receipt || body.receipt;
    }

    const nowIso = new Date().toISOString();
    const upsert = await admin.from("subscriptions").upsert({
      user_id: userId,
      status,
      plan: body.productId || "chasehq_pro_monthly",
      trial_ends_at: trialEndsAt,
      current_period_end: currentPeriodEnd,
      apple_original_transaction_id: originalTransactionId,
      apple_latest_receipt: latestReceipt,
      canceled_at: null,
      last_event_at: nowIso,
    }, { onConflict: "user_id" }).select().maybeSingle();

    if (upsert.error) {
      console.error("validate-apple-receipt upsert error:", upsert.error);
      return json({ error: "Could not record subscription" }, 500);
    }

    await admin.from("subscription_events").insert({
      user_id: userId,
      event_type: body.restore ? "restored" : (wasNew ? "converted" : "renewed"),
      payload: {
        product_id: body.productId,
        current_period_end: currentPeriodEnd,
        mock: useMock,
      },
    });

    return json({ ok: true, status, current_period_end: currentPeriodEnd, trial_ends_at: trialEndsAt, mock: useMock });
  } catch (e) {
    console.error("validate-apple-receipt error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

async function verifyReceiptWithApple(receipt: string, sharedSecret: string) {
  const body = JSON.stringify({
    "receipt-data": receipt,
    "password": sharedSecret,
    "exclude-old-transactions": true,
  });
  let res = await fetch(APPLE_PROD, { method: "POST", body });
  let payload = await res.json();
  if (payload.status === 21007) {
    res = await fetch(APPLE_SANDBOX, { method: "POST", body });
    payload = await res.json();
  }
  if (payload.status !== 0) {
    return { ok: false as const, error: `Apple verifyReceipt failed (status ${payload.status})` };
  }
  return { ok: true as const, payload };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
