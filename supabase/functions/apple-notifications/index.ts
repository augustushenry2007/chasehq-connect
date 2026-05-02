import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { verifyAppleJws } from "../_shared/apple_jws.ts";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "../_shared/rate_limit.ts";
import { logError, logWarn, logInfo } from "../_shared/log.ts";

// Public endpoint (verify_jwt = false) for Apple App Store Server Notifications V2.
// Apple POSTs a signed JWS — we verify the chain to Apple Root CA G3, the cert
// signatures, and the JWS signature with the leaf cert before trusting any
// payload field. Replays are blocked via apple_notification_log idempotency.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
};

interface OuterPayload {
  notificationType: string;
  subtype?: string;
  notificationUUID?: string;
  data?: {
    signedTransactionInfo?: string;
    signedRenewalInfo?: string;
  };
}

interface TransactionInfo {
  originalTransactionId: string;
  expiresDate?: string;
  productId?: string;
}

interface RenewalInfo {
  autoRenewStatus?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const ip = getClientIp(req);
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Per-IP rate limit. Apple's real notification rate is well under this; any
  // abuse is by definition not Apple.
  const rl = await checkRateLimit(admin, `ip:${ip}`, "apple-notifications", 60);
  if (!rl.allowed) return rateLimitedResponse(corsHeaders);

  try {
    const body = await req.json();
    const signedPayload: string | undefined = body?.signedPayload;
    if (!signedPayload) return json({ error: "Missing signedPayload" }, 400);

    // 1. Verify the outer JWS — chain + signatures + Apple root pin.
    const verified = await verifyAppleJws<OuterPayload>(signedPayload);
    if (!verified) {
      logWarn("apple-notifications: JWS verification failed");
      return json({ error: "Invalid signedPayload" }, 401);
    }
    const outer = verified.payload;
    const notificationUUID = outer.notificationUUID;
    if (!notificationUUID) {
      logWarn("apple-notifications: missing notificationUUID");
      return json({ error: "Missing notificationUUID" }, 400);
    }

    // 2. Idempotency: claim this notificationUUID. If insert hits the unique
    // primary key, we've already processed this notification — return 200
    // so Apple doesn't retry, but make no DB changes.
    const claim = await admin.from("apple_notification_log").insert({
      notification_uuid: notificationUUID,
      notification_type: outer.notificationType,
      subtype: outer.subtype ?? null,
    }).select("notification_uuid").maybeSingle();

    if (claim.error) {
      // Conflict (duplicate) is what we want to detect — Postgres returns 23505.
      const code = (claim.error as { code?: string }).code;
      if (code === "23505") {
        logInfo("apple-notifications: duplicate notification, ignoring", notificationUUID);
        return json({ ok: true, idempotent: true });
      }
      logError("apple-notifications: log insert error:", claim.error);
      return json({ error: "Could not claim notification" }, 500);
    }

    // 3. Verify each nested signed JWS.
    const transactionInfo = outer.data?.signedTransactionInfo
      ? (await verifyAppleJws<TransactionInfo>(outer.data.signedTransactionInfo))?.payload ?? null
      : null;
    const renewalInfo = outer.data?.signedRenewalInfo
      ? (await verifyAppleJws<RenewalInfo>(outer.data.signedRenewalInfo))?.payload ?? null
      : null;

    if (!transactionInfo?.originalTransactionId) {
      logWarn("apple-notifications: nested JWS verification failed or missing originalTransactionId");
      return json({ error: "Invalid signed transaction info" }, 400);
    }

    const originalTransactionId = transactionInfo.originalTransactionId;

    const { data: subRow } = await admin
      .from("subscriptions")
      .select("*")
      .eq("apple_original_transaction_id", originalTransactionId)
      .maybeSingle();

    if (!subRow) {
      logWarn("apple-notifications: no subscription row for", originalTransactionId);
      // Mark log entry processed so we don't keep retrying lookups for it.
      await admin
        .from("apple_notification_log")
        .update({ processed_ok: true, original_transaction_id: originalTransactionId })
        .eq("notification_uuid", notificationUUID);
      return json({ ok: true, ignored: true });
    }

    const expiresMs = parseInt(transactionInfo.expiresDate || "0", 10);
    const nowIso = new Date().toISOString();
    const update: Record<string, unknown> = { last_event_at: nowIso };
    let eventType = "webhook_received";

    switch (outer.notificationType) {
      case "DID_RENEW":
      case "SUBSCRIBED":
        update.status = "active";
        update.current_period_end = expiresMs ? new Date(expiresMs).toISOString() : subRow.current_period_end;
        update.canceled_at = null;
        eventType = "renewed";
        break;
      case "DID_FAIL_TO_RENEW":
        update.status = "past_due";
        eventType = "payment_failed";
        break;
      case "GRACE_PERIOD_EXPIRED":
      case "EXPIRED":
        update.status = "expired";
        eventType = "expired";
        break;
      case "DID_CHANGE_RENEWAL_STATUS":
        if (renewalInfo?.autoRenewStatus === 0) {
          update.canceled_at = nowIso;
          eventType = "canceled";
        } else {
          update.canceled_at = null;
          eventType = "renew_resumed";
        }
        break;
      case "REFUND":
      case "REVOKE":
        update.status = "expired";
        update.canceled_at = nowIso;
        eventType = "refunded";
        break;
    }

    await admin.from("subscriptions").update(update).eq("user_id", subRow.user_id);
    await admin.from("subscription_events").insert({
      user_id: subRow.user_id,
      event_type: eventType,
      payload: { notificationType: outer.notificationType, subtype: outer.subtype, transactionInfo, renewalInfo, notificationUUID },
    });

    await admin
      .from("apple_notification_log")
      .update({ processed_ok: true, original_transaction_id: originalTransactionId })
      .eq("notification_uuid", notificationUUID);

    return json({ ok: true });
  } catch (e) {
    logError("apple-notifications error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
