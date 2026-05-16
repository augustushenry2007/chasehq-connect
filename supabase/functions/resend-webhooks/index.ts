// Resend delivery webhook receiver. Resend signs payloads with Svix (their
// webhook signing provider) using HMAC-SHA256(secret, "v1," + msgId + "." +
// timestamp + "." + body). Headers svix-id, svix-timestamp, and svix-signature
// (one or more "v1,<sig>" entries) ride alongside.
//
// Events we care about:
//   email.delivered  — informational; mark delivery_status='delivered'.
//   email.bounced    — permanent bounces: suppress the recipient and mark
//                      delivery_status='bounced'. Soft/transient bounces are
//                      flagged but not suppressed (Resend's payload carries
//                      bounce type in data.bounce.type).
//   email.complained — recipient hit Spam. Suppress + mark.
//
// Webhook URL goes into the Resend dashboard; secret lives in
// RESEND_WEBHOOK_SECRET env. Reject anything that doesn't pass signature check.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logError, logWarn } from "../_shared/log.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function base64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
}

async function verifySvixSignature(
  secret: string,
  msgId: string,
  timestamp: string,
  body: string,
  signatureHeader: string,
): Promise<boolean> {
  // Svix secrets are prefixed "whsec_<base64>". Strip the prefix and decode.
  const raw = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  let keyBytes: Uint8Array;
  try {
    keyBytes = base64ToBytes(raw);
  } catch {
    return false;
  }
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signedPayload = `${msgId}.${timestamp}.${body}`;
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));

  // Header may carry "v1,<sig> v1,<sig>"; one match is sufficient.
  return signatureHeader.split(" ").some((part) => {
    const [version, value] = part.split(",");
    return version === "v1" && value === expected;
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const secret = Deno.env.get("RESEND_WEBHOOK_SECRET");
  if (!secret) {
    logError("[resend-webhooks] RESEND_WEBHOOK_SECRET not configured");
    return new Response("Not configured", { status: 500 });
  }

  const svixId = req.headers.get("svix-id");
  const svixTs = req.headers.get("svix-timestamp");
  const svixSig = req.headers.get("svix-signature");
  if (!svixId || !svixTs || !svixSig) {
    logWarn("[resend-webhooks] missing svix-* headers");
    return new Response("Unauthorized", { status: 401 });
  }

  // Reject anything outside a 5-minute window — Svix recommends 5min.
  const tsSec = Number(svixTs);
  if (!Number.isFinite(tsSec) || Math.abs(Date.now() / 1000 - tsSec) > 300) {
    logWarn("[resend-webhooks] timestamp out of window");
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.text();
  if (!await verifySvixSignature(secret, svixId, svixTs, body, svixSig)) {
    logWarn("[resend-webhooks] signature mismatch");
    return new Response("Unauthorized", { status: 401 });
  }

  let event: {
    type?: string;
    data?: {
      email_id?: string;
      to?: string | string[];
      bounce?: { type?: string; message?: string };
    };
  };
  try {
    event = JSON.parse(body);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const messageId = event.data?.email_id;
  const recipient = Array.isArray(event.data?.to) ? event.data?.to[0] : event.data?.to;
  const lowerRecipient = recipient?.toLowerCase();

  switch (event.type) {
    case "email.delivered": {
      if (messageId) {
        await admin
          .from("email_send_log")
          .update({ delivery_status: "delivered" })
          .eq("resend_message_id", messageId);
      }
      break;
    }
    case "email.bounced": {
      const bounceType = event.data?.bounce?.type ?? "unknown";
      const reason = event.data?.bounce?.message?.slice(0, 500) ?? null;
      if (messageId) {
        await admin
          .from("email_send_log")
          .update({ delivery_status: "bounced", bounce_reason: reason })
          .eq("resend_message_id", messageId);
      }
      // Permanent ("hard") bounces only — soft/transient bounces shouldn't
      // suppress, the next attempt may succeed.
      if (lowerRecipient && /hard|permanent/i.test(bounceType)) {
        await admin
          .from("email_suppressions")
          .upsert(
            { recipient: lowerRecipient, reason: "bounce", source: bounceType },
            { onConflict: "recipient", ignoreDuplicates: true },
          );
      }
      break;
    }
    case "email.complained": {
      if (messageId) {
        await admin
          .from("email_send_log")
          .update({ delivery_status: "complained" })
          .eq("resend_message_id", messageId);
      }
      if (lowerRecipient) {
        await admin
          .from("email_suppressions")
          .upsert(
            { recipient: lowerRecipient, reason: "complaint", source: "resend-webhook" },
            { onConflict: "recipient", ignoreDuplicates: true },
          );
      }
      break;
    }
    default:
      // Ignore other event types (email.sent, email.opened, email.clicked) —
      // we don't gate on them today.
      break;
  }

  return new Response("OK", { status: 200 });
});
