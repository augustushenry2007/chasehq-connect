import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { buildCors } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitedResponse } from "../_shared/rate_limit.ts";
import { logError, logWarn } from "../_shared/log.ts";
import { verifyWithRevenueCat } from "../_shared/revenuecat.ts";

type Json = (body: unknown, status?: number) => Response;

// Verifies a Supabase JWT locally — handles both legacy HS256 and new ES256 (ECC P-256) keys.
// Falls back to the admin getUser API if local verification fails.
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

const DAILY_SEND_CAP = 50;

function buildPlainHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br />");
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="margin:0;padding:32px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;background:#ffffff;max-width:600px;">${escaped}</body></html>`;
}

function formatCopyTimestamp(d: Date): string {
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function buildCopyHtml(originalText: string, clientEmail: string, sentAt: Date): string {
  const escapedOriginal = originalText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br />");
  const escapedRecipient = clientEmail
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const ts = formatCopyTimestamp(sentAt);
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="margin:0;padding:32px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;background:#ffffff;max-width:600px;"><div style="margin:0 0 24px 0;padding:16px 20px;border:1px solid #e5e7eb;border-radius:12px;background:#f9fafb;font-size:13px;line-height:1.5;color:#374151;"><div style="font-weight:600;color:#111827;margin-bottom:6px;">📨 Copy for your records</div><div>You sent this to <strong>${escapedRecipient}</strong> on ${ts}.</div><div style="margin-top:6px;color:#6b7280;font-size:12px;">Your client received the message below — they did not see this banner.</div></div><div style="border-top:1px solid #e5e7eb;padding-top:20px;">${escapedOriginal}</div></body></html>`;
}

function buildCopyPlainText(originalText: string, clientEmail: string, sentAt: Date): string {
  return `[Copy for your records]\nYou sent this to ${clientEmail} on ${formatCopyTimestamp(sentAt)}.\nYour client received the message below — they did not see this banner.\n\n---\n\n${originalText}`;
}

serve(async (req) => {
  const cors = buildCors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const json: Json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  try {
    const { to, subject, message, invoiceId, tone, isAiGenerated } = await req.json();
    if (!to || !subject || !message) {
      return json({ error: "Missing to, subject, or message" }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(to))) {
      return json({ error: "Invalid recipient email" }, 400);
    }

    const userToken = req.headers.get("X-User-Token") ??
      req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!userToken) return json({ error: "Not authenticated" }, 401);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const userId = await verifySupabaseJWT(userToken, Deno.env.get("SUPABASE_URL")!);
    if (!userId) return json({ error: "Invalid session" }, 401);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (authError || !user) return json({ error: "Invalid session" }, 401);

    // Idempotency: a slow-but-successful send can exceed the client's 15s timeout,
    // making the client report failure and the user re-tap Send — which would
    // dispatch a *second* identical chase email. If we already wrote a followups
    // row for this exact (invoice, subject, message) in the last few minutes, the
    // email already went out — return success without sending or logging again.
    // Best-effort: `followups` carries a user DELETE policy, so a tampered client
    // could defeat this, but that just degrades to today's behaviour. We do this
    // before the rate-limit / entitlement checks so a retry is a cheap no-op.
    if (invoiceId) {
      const dedupSince = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: recentDup, error: dedupErr } = await supabaseAdmin
        .from("followups")
        .select("id")
        .eq("user_id", user.id)
        .eq("invoice_id", String(invoiceId))
        .eq("subject", String(subject))
        .eq("message", String(message))
        .gte("sent_at", dedupSince)
        .limit(1);
      if (!dedupErr && recentDup && recentDup.length > 0) {
        logWarn("[send-email] deduplicated repeat send", { userId: user.id, invoiceId: String(invoiceId) });
        return json({ success: true, via: "dedup", deduped: true });
      }
    }

    const rl = await checkRateLimit(supabaseAdmin, user.id, "send-email", 30);
    if (!rl.allowed) return rateLimitedResponse(cors);

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .maybeSingle();

    const metaMeta = user.user_metadata as Record<string, unknown> | undefined;
    const resolvedName = (
      (typeof profile?.full_name === "string" && profile.full_name.trim())
      || (typeof metaMeta?.full_name === "string" && (metaMeta.full_name as string).trim())
      || (typeof metaMeta?.name === "string" && (metaMeta.name as string).trim())
      || ""
    ).toString().trim();
    // Strip header-injection chars (\r \n) and quotes that would break the From line
    const safeName = resolvedName.replace(/[<>"\r\n]/g, "").slice(0, 80);

    const { data: hasEnt, error: entErr } = await supabaseAdmin
      .rpc("has_active_entitlement", { _user_id: user.id });
    if (entErr) {
      logError("entitlement check error:", entErr);
      return json({ error: "subscription_required", message: "Could not verify subscription. Please try again." });
    }

    let canSend = !!hasEnt;

    // Server-side RevenueCat fallback: has_active_entitlement reads only the
    // `subscriptions` table. Right after a purchase, if validate-apple-receipt
    // had a brief outage (its 3-retry sync exhausted), that row may not exist yet
    // even though the user is genuinely entitled — the client trusts the RC SDK
    // and shows canSend=true, so without this the user taps Send and gets a
    // bogus subscription_required. The RC app-user-id is always this session's
    // uid (Purchases.logIn is called before any purchase), so verifying for
    // user.id is secure and scoped. On success, self-heal the subscriptions row.
    if (!canSend) {
      const rcSecretKey = Deno.env.get("RC_SECRET_KEY");
      if (rcSecretKey) {
        try {
          const rc = await verifyWithRevenueCat(user.id, rcSecretKey);
          if (rc.ok) {
            canSend = true;
            const { error: healErr } = await supabaseAdmin.from("subscriptions").upsert({
              user_id: user.id,
              status: rc.status,
              plan: "chasehq_pro_monthly",
              trial_ends_at: rc.trialEndsAt,
              current_period_end: rc.currentPeriodEnd,
              apple_original_transaction_id: rc.originalTransactionId,
              canceled_at: null,
              last_event_at: new Date().toISOString(),
            }, { onConflict: "user_id" });
            if (healErr) logWarn("[send-email] RC fallback subscriptions self-heal failed:", healErr);
            else logWarn("[send-email] entitlement granted via RC fallback; subscriptions row self-healed", { userId: user.id });
          }
        } catch (e) {
          logWarn("[send-email] RC fallback verification threw:", e instanceof Error ? e.message : String(e));
        }
      }
    }

    if (!canSend) {
      // "One free send, then subscribe." Count it from email_send_log — NOT
      // followups — because `followups` carries a user DELETE RLS policy (clients
      // legitimately clean it up when deleting an invoice), so a non-subscriber
      // could otherwise reset the count and keep sending for free. email_send_log
      // is service-role-write-only with no user delete policy, so it can't be tampered with.
      const { count: priorSends, error: priorErr } = await supabaseAdmin
        .from("email_send_log")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      if (priorErr) {
        // Don't swallow this — if email_send_log is unreadable (e.g. the table
        // is missing on this env, the schema-drift case 20260511050000 fixes),
        // the free-send gate is unavailable. Stay fail-closed (canSend stays
        // false), but make the reason visible instead of silently denying.
        logError("[send-email] email_send_log read failed — free-send gate unavailable:", priorErr);
      } else {
        canSend = (priorSends ?? 0) === 0;
      }
    }

    if (!canSend) {
      return json({ error: "subscription_required", message: "Your trial has ended. Subscribe to keep sending follow-ups." });
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: sendCount, error: countErr } = await supabaseAdmin
      .from("email_send_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("sent_at", since);
    if (countErr) {
      logError("rate-limit count error:", countErr);
    } else if ((sendCount ?? 0) >= DAILY_SEND_CAP) {
      return json({
        error: "rate_limited",
        message: `You've hit today's limit of ${DAILY_SEND_CAP} sends. Try again tomorrow.`,
      });
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      logError("send-email: RESEND_API_KEY not configured");
      return json({ error: "send_unavailable", message: "Sending is temporarily unavailable. Please try again shortly." }, 500);
    }

    // Resend sends from ChaseHQ's verified domain. Display name carries the
    // user's name + "via ChaseHQ" so recipients know it's their freelancer's
    // outreach (not an automated chasehq.app email). Reply-To routes responses
    // to the user's signup inbox.
    const fromHeader = safeName
      ? `${safeName} via ChaseHQ <noreply@chasehq.app>`
      : "ChaseHQ <noreply@chasehq.app>";
    const replyTo = user.email ?? undefined;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: fromHeader,
        to: [to],
        subject,
        text: message,
        html: buildPlainHtml(message),
        reply_to: replyTo,
        headers: invoiceId ? { "X-Entity-Ref-ID": String(invoiceId) } : undefined,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      logError("send-email Resend error:", res.status, body.slice(0, 300));
      return json({ error: "send_failed", message: "We couldn't send this one. Your draft is safe — give it another try." }, 502);
    }

    // Distinct "copy for your records" email to the sender. Separate envelope
    // (no "via ChaseHQ" From, "Copy:" subject prefix, banner at top of body) so
    // their inbox clearly shows this is a sent-archive, not a fresh outbound
    // chase. Non-fatal on failure — the client email already went out and the
    // in-app followups timeline is the source of truth.
    if (user.email) {
      const sentAt = new Date();
      const copyRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify({
          from: "ChaseHQ <noreply@chasehq.app>",
          to: [user.email],
          subject: `Copy: ${subject}`,
          text: buildCopyPlainText(message, to, sentAt),
          html: buildCopyHtml(message, to, sentAt),
        }),
      });
      if (!copyRes.ok) {
        const body = await copyRes.text();
        logWarn("[send-email] user-copy Resend error (non-fatal):", copyRes.status, body.slice(0, 300));
      }
    }

    const { error: sendLogErr } = await supabaseAdmin.from("email_send_log").insert({
      user_id: user.id,
      recipient: to,
      invoice_id: invoiceId ?? null,
    });
    if (sendLogErr) {
      // This is a money + audit record (the free-send tally is counted from it,
      // and it's the canonical "we sent this") — losing it silently is bad.
      logError("[send-email] email_send_log insert failed — free-send tally + delivery record lost:", sendLogErr);
    }

    // Record the follow-up in the timeline. This is the source of truth for
    // "this step was sent" (ChaseSchedule reads it) and the UI's free-send badge
    // (useEntitlement reads the count). Writing it here — server-side, immediately
    // after the send, on the service-role client — closes the window where the old
    // client-side recordFollowup could fail after the email already went out and
    // leave the schedule showing the step un-sent. NOTE: the *authoritative*
    // free-send gate above counts email_send_log, not this table, because clients
    // can delete their own followups rows via RLS.
    if (invoiceId) {
      const followupRow = {
        user_id: user.id,
        invoice_id: String(invoiceId),
        subject: String(subject),
        message: String(message),
        tone: typeof tone === "string" && tone.trim() ? tone.trim().slice(0, 40) : "Friendly",
        is_ai_generated: isAiGenerated === true,
        sent_at: new Date().toISOString(),
      };
      let { error: fErr } = await supabaseAdmin.from("followups").insert(followupRow);
      if (fErr) {
        logWarn("[send-email] followups insert failed, retrying:", fErr);
        ({ error: fErr } = await supabaseAdmin.from("followups").insert(followupRow));
        if (fErr) logWarn("[send-email] followups insert failed after retry:", fErr);
      }
    }

    return json({ success: true, via: "resend" });
  } catch (e) {
    logError("send-email error:", e);
    return json({ error: "Internal error" }, 500);
  }
});
