import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Not authenticated" }, 401);

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return json({ error: "Invalid session" }, 401);

    const body = await req.json() as ValidatePayload;
    if (!body?.receipt) return json({ error: "Missing receipt" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: existing } = await admin
      .from("subscriptions").select("*").eq("user_id", user.id).maybeSingle();

    let status: "active" = "active";
    let currentPeriodEnd: string;
    let originalTransactionId: string;
    let latestReceipt = body.receipt;
    const wasNew = !existing || existing.status !== "active";

    // === MOCK PATH (web preview / dev) ===
    // Triggered when the client signals a mock receipt OR when Apple secrets
    // are not yet configured. This lets the full flow be tested without iOS.
    const sharedSecret = Deno.env.get("APPLE_SHARED_SECRET");
    const useMock = body.mock === true || !sharedSecret;

    if (useMock) {
      currentPeriodEnd = new Date(Date.now() + 30 * 86400_000).toISOString();
      originalTransactionId = `mock_${user.id}`;
    } else {
      // === REAL APPLE VALIDATION ===
      const verify = await verifyReceiptWithApple(body.receipt, sharedSecret!);
      if (!verify.ok) return json({ error: verify.error }, 400);

      const latestInfo = verify.payload.latest_receipt_info?.[0]
        ?? verify.payload.receipt?.in_app?.[0];
      if (!latestInfo) return json({ error: "No subscription info in receipt" }, 400);

      const expiresMs = parseInt(latestInfo.expires_date_ms || "0", 10);
      if (!expiresMs) return json({ error: "Receipt missing expiration" }, 400);

      currentPeriodEnd = new Date(expiresMs).toISOString();
      originalTransactionId = latestInfo.original_transaction_id;
      latestReceipt = verify.payload.latest_receipt || body.receipt;

      if (expiresMs < Date.now()) status = "active"; // still upsert; webhook will mark expired later
    }

    const nowIso = new Date().toISOString();
    const upsert = await admin.from("subscriptions").upsert({
      user_id: user.id,
      status,
      plan: body.productId || "chasehq_pro_monthly",
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
      user_id: user.id,
      event_type: body.restore ? "restored" : (wasNew ? "converted" : "renewed"),
      payload: {
        product_id: body.productId,
        current_period_end: currentPeriodEnd,
        mock: useMock,
      },
    });

    return json({ ok: true, status, current_period_end: currentPeriodEnd, mock: useMock });
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
  // Try production first; if status 21007 → sandbox.
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
