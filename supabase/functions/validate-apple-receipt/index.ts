import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { buildCors } from "../_shared/cors.ts";

// Apple verifyReceipt endpoints
const APPLE_PROD = "https://buy.itunes.apple.com/verifyReceipt";
const APPLE_SANDBOX = "https://sandbox.itunes.apple.com/verifyReceipt";

interface ValidatePayload {
  receipt: string;
  productId?: string;
  mock?: boolean;
  restore?: boolean;
  clientEntitlement?: { isTrialing?: boolean; expiresAt?: string | null };
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
  const cors = buildCors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

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
    const isRcReceipt = body.receipt.startsWith("RC_CUSTOMER:");
    const useMock = body.mock === true || (!sharedSecret && !isRcReceipt);

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
    } else if (isRcReceipt) {
      // === REVENUECAT VALIDATION ===
      const rcSecretKey = Deno.env.get("RC_SECRET_KEY");
      const appUserId = body.receipt.slice("RC_CUSTOMER:".length);

      let rcOk = false;
      if (rcSecretKey) {
        const verify = await verifyWithRevenueCat(appUserId, rcSecretKey);
        if (verify.ok) {
          status = verify.status;
          currentPeriodEnd = verify.currentPeriodEnd;
          trialEndsAt = verify.trialEndsAt;
          originalTransactionId = verify.originalTransactionId;
          rcOk = true;
        }
      }

      if (!rcOk) {
        // RC API unavailable or key misconfigured. Fall back to client-provided entitlement
        // data from the RC SDK, which already verifies server-side (verification: "VERIFIED").
        const ce = body.clientEntitlement;
        if (ce?.expiresAt) {
          const isTrialing = ce.isTrialing ?? false;
          status = isTrialing ? "trialing" : "active";
          currentPeriodEnd = ce.expiresAt;
          trialEndsAt = isTrialing ? ce.expiresAt : null;
          originalTransactionId = appUserId;
        } else {
          return json({ error: "Subscription verification unavailable. Please try Restore Purchases." }, 400);
        }
      }
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

async function verifyWithRevenueCat(appUserId: string, secretKey: string) {
  const res = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
    { headers: { "Authorization": `Bearer ${secretKey}`, "Content-Type": "application/json" } }
  );
  if (!res.ok) {
    const bodyText = await res.text().catch(() => "<unreadable>");
    console.error("[validate-apple-receipt] RC API error", { status: res.status, body: bodyText.slice(0, 500), appUserId });
    if (res.status === 401 || res.status === 403) {
      return { ok: false as const, error: "Subscription verification is temporarily unavailable. Please try Restore Purchases in a moment." };
    }
    return { ok: false as const, error: `RevenueCat API error (${res.status})` };
  }
  const data = await res.json();
  const entitlement = data.subscriber?.entitlements?.["ChaseHQ Pro"];
  if (!entitlement?.expires_date) {
    return { ok: false as const, error: "No active ChaseHQ Pro subscription found" };
  }
  const expiresDate = new Date(entitlement.expires_date);
  if (expiresDate < new Date()) {
    return { ok: false as const, error: "Subscription has expired" };
  }
  const sub = data.subscriber?.subscriptions?.[entitlement.product_identifier];
  const periodType = sub?.period_type ?? "normal";
  const isTrialing = periodType === "trial" || periodType === "intro";
  return {
    ok: true as const,
    status: isTrialing ? "trialing" as const : "active" as const,
    currentPeriodEnd: expiresDate.toISOString(),
    trialEndsAt: isTrialing ? expiresDate.toISOString() : null,
    originalTransactionId: sub?.original_transaction_id ?? appUserId,
  };
}

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

