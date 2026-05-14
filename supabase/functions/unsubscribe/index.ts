// Public unsubscribe endpoint hit by:
//   1. Mailbox providers (Gmail, Yahoo, Apple Mail) doing the Feb-2024
//      one-click POST per RFC 8058 — they send POST with body
//      "List-Unsubscribe=One-Click" against the URL in the List-Unsubscribe
//      header. We must apply the unsubscribe immediately without any user
//      interaction and respond 200 within ~10s.
//   2. A human clicking the URL in their inbox client's "Unsubscribe" link
//      (some clients prefer the URL over the mailto), in which case we render
//      a tiny confirmation page.
//
// Token (?t=) is HMAC-SHA256(recipient, SUPABASE_JWT_SECRET) truncated to 16
// hex chars. Stops a scanner from suppressing arbitrary recipient addresses by
// guessing URLs. The worst case of a forged URL is still failsafe (we just
// stop emailing someone who didn't ask) — the HMAC is defence in depth, not
// the gate on damage potential.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logError } from "../_shared/log.ts";
import { verifyUnsubscribeToken } from "../_shared/unsubscribe.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function htmlPage(title: string, body: string, status = 200): Response {
  return new Response(
    `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:48px 24px;background:#f4f6f8;color:#1a2b35}main{max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;box-shadow:0 2px 12px rgba(0,0,0,0.07)}h1{margin:0 0 12px;font-size:20px}p{margin:0 0 8px;color:#4b5563;line-height:1.6;font-size:15px}</style></head><body><main>${body}</main></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

async function applySuppression(recipient: string, source: string): Promise<boolean> {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  // Idempotent: PK conflict on `recipient` is the success path (already
  // suppressed by an earlier unsubscribe).
  const { error } = await admin
    .from("email_suppressions")
    .upsert(
      { recipient: recipient.toLowerCase(), reason: "unsubscribe", source },
      { onConflict: "recipient", ignoreDuplicates: true },
    );
  if (error) {
    logError("[unsubscribe] insert failed:", error.message);
    return false;
  }
  return true;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const recipient = (url.searchParams.get("r") ?? "").trim();
  const token = (url.searchParams.get("t") ?? "").trim();

  if (!recipient || !token) {
    return htmlPage("Invalid link", "<h1>Invalid link</h1><p>This unsubscribe link is missing required parameters.</p>", 400);
  }
  if (!await verifyUnsubscribeToken(recipient, token)) {
    return htmlPage("Invalid link", "<h1>Invalid link</h1><p>This unsubscribe link is no longer valid.</p>", 400);
  }

  // One-click POST per RFC 8058: providers send POST with no UI. Apply silently
  // and return 200; the provider chooses how to display the result to its user.
  if (req.method === "POST") {
    const ok = await applySuppression(recipient, "one-click-post");
    return new Response(ok ? "OK" : "Error", { status: ok ? 200 : 500 });
  }

  // GET: a human is viewing this in a browser. Apply + render a confirmation.
  if (req.method === "GET") {
    const ok = await applySuppression(recipient, "browser-get");
    if (!ok) {
      return htmlPage(
        "Something went wrong",
        "<h1>We couldn't process that</h1><p>Please try again in a moment, or email <a href=\"mailto:unsubscribe@chasehq.app\">unsubscribe@chasehq.app</a>.</p>",
        500,
      );
    }
    return htmlPage(
      "You're unsubscribed",
      `<h1>You're unsubscribed</h1><p>We'll no longer send follow-up emails to <strong>${recipient.replace(/[<>"'&]/g, "")}</strong>.</p><p>If this was a mistake, reply to the original email to let the sender know.</p>`,
    );
  }

  return new Response("Method not allowed", { status: 405 });
});
