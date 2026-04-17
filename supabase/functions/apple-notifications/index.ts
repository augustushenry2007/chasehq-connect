import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Public endpoint: Apple App Store Server Notifications V2.
// Apple POSTs a signed JWS payload. We decode & route by notificationType.
// Note: Full JWS signature verification against Apple's public certificate chain
// is recommended for production. This implementation decodes the JWS payload
// and updates state; signature verification can be hardened once
// APPLE_KEY_ID / APPLE_ISSUER_ID / APPLE_PRIVATE_KEY are configured.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const body = await req.json();
    const signedPayload: string | undefined = body?.signedPayload;
    if (!signedPayload) return json({ error: "Missing signedPayload" }, 400);

    const decoded = decodeJws(signedPayload);
    if (!decoded) return json({ error: "Invalid signedPayload" }, 400);

    const notificationType: string = decoded.notificationType;
    const subtype: string | undefined = decoded.subtype;
    const dataSignedTransactionInfo = decoded.data?.signedTransactionInfo;
    const dataSignedRenewalInfo = decoded.data?.signedRenewalInfo;
    const transactionInfo = dataSignedTransactionInfo ? decodeJws(dataSignedTransactionInfo) : null;
    const renewalInfo = dataSignedRenewalInfo ? decodeJws(dataSignedRenewalInfo) : null;

    const originalTransactionId: string | undefined = transactionInfo?.originalTransactionId;
    if (!originalTransactionId) return json({ error: "No originalTransactionId" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: subRow } = await admin
      .from("subscriptions")
      .select("*")
      .eq("apple_original_transaction_id", originalTransactionId)
      .maybeSingle();

    if (!subRow) {
      console.warn("apple-notifications: no subscription row for", originalTransactionId);
      return json({ ok: true, ignored: true });
    }

    const expiresMs = parseInt(transactionInfo?.expiresDate || "0", 10);
    const nowIso = new Date().toISOString();
    const update: Record<string, unknown> = { last_event_at: nowIso };
    let eventType = "webhook_received";

    switch (notificationType) {
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
      payload: { notificationType, subtype, transactionInfo, renewalInfo },
    });

    return json({ ok: true });
  } catch (e) {
    console.error("apple-notifications error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function decodeJws(jws: string): any {
  try {
    const parts = jws.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1];
    // base64url decode
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const json = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
