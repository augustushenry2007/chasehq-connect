// Cron-driven dispatcher. Two passes per tick:
//   1. "due"   — pending notifications whose scheduled_for has passed: re-validate
//                the invoice, respect user prefs + quiet hours, mark them delivered
//                (the in-app reminder), and — if email is enabled — send the Resend
//                email. Email outcome is tracked separately (email_sent_at /
//                email_attempts) so a failed email can be retried without
//                re-delivering the in-app notification.
//   2. "retry" — rows already delivered whose email never went out
//                (email_sent_at IS NULL, email_attempts < 5, within a 2-day window):
//                re-attempt the email only. Idempotent via email_sent_at IS NULL;
//                bounded by email_attempts < 5. Rows that exhaust the attempts are
//                dead-lettered — their count is surfaced in the response + logs.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logError, logWarn } from "../_shared/log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = "ChaseHQ <noreply@chasehq.app>";

const MAX_EMAIL_ATTEMPTS = 5;
const RETRY_WINDOW_HOURS = 48;
const DEAD_LETTER_WINDOW_HOURS = 24 * 7;

// Advisory-lock key. Any 32-bit int will do; we just need a constant so all
// invocations contend on the same lock.
const ADVISORY_LOCK_KEY = 7271_1942;

function constantTimeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function hourInTimezone(tz: string): number {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false });
    return parseInt(fmt.format(new Date()), 10);
  } catch {
    return new Date().getUTCHours();
  }
}

function isQuietHour(hour: number, start: number, end: number): boolean {
  if (start === end) return false;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

// Returns true only when Resend accepted the message. Throws are *not* caught
// here — the per-row handler treats a throw the same as a `false` (a failed
// attempt) but logs the stack.
async function sendResendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    logWarn("RESEND_API_KEY not set — skipping email");
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  if (!res.ok) {
    logError("Resend error:", res.status, (await res.text()).slice(0, 300));
    return false;
  }
  return true;
}

type DueRow = {
  id: string;
  user_id: string;
  invoice_id: string;
  type: string;
  title: string;
  body: string;
  scheduled_for: string;
  attempts: number | null;
  email_attempts: number | null;
};

type Invoice = {
  id: string;
  user_id: string;
  status: string;
  client: string;
  amount: number;
  days_past_due: number;
  invoice_number: string;
};

function buildEmailContent(inv: Invoice): { subject: string; html: string } {
  const amountFormatted = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(inv.amount));
  const overdueText = inv.days_past_due > 0
    ? `${inv.days_past_due} day${inv.days_past_due === 1 ? "" : "s"} overdue`
    : "due soon";
  const subject = `Follow-up due: ${inv.client} · ${inv.invoice_number}`;
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="margin:0 0 8px;font-size:18px;color:#111">Time to follow up</h2>
      <p style="margin:0 0 16px;color:#555;font-size:14px">
        A follow-up is due for <strong>${inv.client}</strong> — invoice <strong>${inv.invoice_number}</strong>
        for <strong>${amountFormatted}</strong> is <strong>${overdueText}</strong>.
      </p>
      <p style="margin:0 0 24px;color:#555;font-size:14px">Open ChaseHQ to review the AI-drafted follow-up and send it when you're ready.</p>
      <p style="margin:0;color:#aaa;font-size:12px">You're receiving this because you enabled email notifications in ChaseHQ settings.</p>
    </div>
  `;
  return { subject, html };
}

// Shared validity gate for a notification row: the invoice still exists, is
// unpaid, is owned by the same user, and its schedule isn't paused. Returns the
// invoice on success, or { cancel: true } when the row is no longer valid.
async function validateForRow(
  admin: ReturnType<typeof createClient>,
  n: { id: string; user_id: string; invoice_id: string },
): Promise<{ invoice: Invoice } | { cancel: true }> {
  const { data: inv } = await admin
    .from("invoices")
    .select("id, user_id, status, client, amount, days_past_due, invoice_number")
    .eq("id", n.invoice_id)
    .maybeSingle();
  if (!inv || inv.status === "Paid") return { cancel: true };
  if (inv.user_id !== n.user_id) {
    logWarn("dispatch: notification owner != invoice owner; canceling", { notifId: n.id });
    return { cancel: true };
  }
  const { data: sched } = await admin
    .from("followup_schedules")
    .select("paused")
    .eq("invoice_id", n.invoice_id)
    .maybeSingle();
  if (sched?.paused) return { cancel: true };
  return { invoice: inv as Invoice };
}

async function getPrefs(admin: ReturnType<typeof createClient>, userId: string) {
  const { data: prefs } = await admin
    .from("notification_preferences")
    .select("enabled, email_enabled, quiet_hours_start, quiet_hours_end, timezone")
    .eq("user_id", userId)
    .maybeSingle();
  return {
    enabled: prefs?.enabled ?? false,
    emailEnabled: prefs?.email_enabled ?? false,
    tz: prefs?.timezone ?? "UTC",
    qStart: prefs?.quiet_hours_start ?? 21,
    qEnd: prefs?.quiet_hours_end ?? 8,
  };
}

async function getUserEmail(admin: ReturnType<typeof createClient>, userId: string): Promise<string | null> {
  const { data: authUser } = await admin.auth.admin.getUserById(userId);
  return authUser?.user?.email ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // === Auth gate ===
  const cronSecret = Deno.env.get("CRON_DISPATCH_SECRET");
  if (!cronSecret) {
    logError("CRON_DISPATCH_SECRET not set — refusing to run unauthenticated dispatcher");
    return new Response(JSON.stringify({ error: "Dispatcher not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const provided = req.headers.get("x-cron-secret") ?? "";
  if (!constantTimeStringEqual(provided, cronSecret)) {
    logWarn("dispatch-notifications: missing/invalid x-cron-secret");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // === Concurrency guard ===
  const lockRes = await admin.rpc("pg_try_advisory_lock", { key: ADVISORY_LOCK_KEY });
  if (lockRes.error) {
    logError("advisory lock RPC unavailable — skipping run (deploy 20260503000000_advisory_lock_wrapper.sql):", lockRes.error.message);
    return new Response(JSON.stringify({ skipped: "advisory lock unavailable" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (lockRes.data === false) {
    return new Response(JSON.stringify({ skipped: "another dispatch in progress" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // === Heartbeat ===
  // We hold the lock — this run is really happening. Read last_ok_at *before*
  // stamping last_run_at so we can tell whether prior hourly runs were missed
  // while the function was down/undeployed (the cron's net.http_post is
  // fire-and-forget — pg_net never awaits or retries, so a 5xx batch just
  // doesn't run; the next OK run self-heals via `scheduled_for <= now()`, so the
  // visible effect is *delayed* notifications, not lost — and nothing watches).
  // dispatch-health-check re-fires us if last_ok_at goes >90min stale; this just
  // surfaces the gap in the logs + response the moment service comes back.
  let lastOkAt: string | null = null;
  try {
    const { data: hb } = await admin.from("dispatch_health").select("last_ok_at").eq("id", 1).maybeSingle();
    lastOkAt = (hb?.last_ok_at as string | null) ?? null;
  } catch { /* dispatch_health missing on this env — non-fatal, heartbeat is best-effort */ }
  try {
    await admin.from("dispatch_health").upsert({ id: 1, last_run_at: new Date().toISOString() }, { onConflict: "id" });
  } catch { /* best-effort */ }

  let missedRunsSince: string | null = null;
  if (lastOkAt) {
    const staleMs = Date.now() - new Date(lastOkAt).getTime();
    const HOUR_MS = 3600_000;
    if (staleMs > 2 * HOUR_MS) {
      const missed = Math.max(1, Math.floor(staleMs / HOUR_MS) - 1);
      missedRunsSince = lastOkAt;
      logError(`dispatch: ~${missed} hourly run(s) missed since ${lastOkAt} — function was likely down/undeployed`);
    }
  }

  try {
  const now = new Date();
  const nowISO = now.toISOString();
  const retryFloorISO = new Date(now.getTime() - RETRY_WINDOW_HOURS * 3600_000).toISOString();
  const deadLetterFloorISO = new Date(now.getTime() - DEAD_LETTER_WINDOW_HOURS * 3600_000).toISOString();

  // --- Pass 1: due pending notifications ---
  const { data: due, error } = await admin
    .from("notifications")
    .select("id, user_id, invoice_id, type, title, body, scheduled_for, attempts, email_attempts")
    .eq("status", "pending")
    .lte("scheduled_for", nowISO)
    .order("scheduled_for", { ascending: true })
    .limit(200);

  if (error) {
    // Throw so the outer catch records it in dispatch_health.last_error.
    throw new Error(`fetch pending failed: ${error.message}`);
  }

  let delivered = 0;
  let canceled = 0;
  let deferred = 0;
  let emailsSent = 0;
  let emailFailures = 0;

  for (const n of (due ?? []) as DueRow[]) {
    try {
      const v = await validateForRow(admin, n);
      if ("cancel" in v) {
        await admin.from("notifications").update({ status: "canceled" }).eq("id", n.id);
        canceled++;
        continue;
      }
      const inv = v.invoice;

      const { enabled, emailEnabled, tz, qStart, qEnd } = await getPrefs(admin, n.user_id);
      if (isQuietHour(hourInTimezone(tz), qStart, qEnd)) {
        deferred++;
        continue;
      }

      // Atomic claim: only this invocation gets to deliver this row.
      const { data: claimed, error: claimErr } = await admin
        .from("notifications")
        .update({ status: "delivered", delivered_at: new Date().toISOString(), attempts: (n.attempts ?? 0) + 1 })
        .eq("id", n.id)
        .eq("status", "pending")
        .select("id");
      if (claimErr) {
        logError("Failed to claim notification", n.id, claimErr.message);
        continue;
      }
      if (!claimed || claimed.length === 0) continue; // already claimed by another run
      delivered++;

      // Email is a separate channel — its failure must not undo the in-app delivery.
      if (enabled && emailEnabled) {
        const userEmail = await getUserEmail(admin, n.user_id);
        if (userEmail) {
          const { subject, html } = buildEmailContent(inv);
          let sent = false;
          try {
            sent = await sendResendEmail(userEmail, subject, html);
          } catch (e) {
            logError("Resend threw for notification", n.id, e instanceof Error ? e.message : String(e));
          }
          if (sent) {
            emailsSent++;
            await admin.from("notifications").update({ email_sent_at: new Date().toISOString() }).eq("id", n.id);
          } else {
            emailFailures++;
            await admin.from("notifications").update({ email_attempts: (n.email_attempts ?? 0) + 1 }).eq("id", n.id);
            logWarn("dispatch: email send failed for notification", n.id);
          }
        }
        // No user email (deleted auth row) → leave email_sent_at NULL; not retried.
      }
    } catch (e) {
      logError("dispatch row failed (continuing batch)", n.id, e instanceof Error ? e.message : String(e));
      continue;
    }
  }

  // --- Pass 2: re-attempt emails that never went out ---
  let emailRetries = 0;
  const { data: retryRows } = await admin
    .from("notifications")
    .select("id, user_id, invoice_id, type, title, body, scheduled_for, attempts, email_attempts")
    .eq("status", "delivered")
    .is("email_sent_at", null)
    .lt("email_attempts", MAX_EMAIL_ATTEMPTS)
    .gte("scheduled_for", retryFloorISO)
    .order("scheduled_for", { ascending: true })
    .limit(100);

  for (const n of (retryRows ?? []) as DueRow[]) {
    try {
      const v = await validateForRow(admin, n);
      // The in-app notification already delivered; if the invoice is now paid /
      // deleted / paused we just stop retrying the email — we don't rewrite the
      // already-delivered row's status (matches the invoice-change trigger, which
      // only cancels *pending* rows). The 48h retry window ages it out.
      if ("cancel" in v) continue;
      const inv = v.invoice;

      const { enabled, emailEnabled, tz, qStart, qEnd } = await getPrefs(admin, n.user_id);
      if (!enabled || !emailEnabled) continue; // email no longer applicable — leave as-is
      if (isQuietHour(hourInTimezone(tz), qStart, qEnd)) {
        deferred++;
        continue;
      }

      const userEmail = await getUserEmail(admin, n.user_id);
      if (!userEmail) continue;

      const { subject, html } = buildEmailContent(inv);
      let sent = false;
      try {
        sent = await sendResendEmail(userEmail, subject, html);
      } catch (e) {
        logError("Resend threw on retry for notification", n.id, e instanceof Error ? e.message : String(e));
      }
      if (sent) {
        emailRetries++;
        emailsSent++;
        await admin.from("notifications").update({ email_sent_at: new Date().toISOString() }).eq("id", n.id);
      } else {
        emailFailures++;
        await admin.from("notifications").update({ email_attempts: (n.email_attempts ?? 0) + 1 }).eq("id", n.id);
      }
    } catch (e) {
      logError("dispatch retry row failed (continuing batch)", n.id, e instanceof Error ? e.message : String(e));
      continue;
    }
  }

  // --- Dead-letter visibility: emails that exhausted all attempts ---
  const { count: deadLetterCount } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("status", "delivered")
    .is("email_sent_at", null)
    .gte("email_attempts", MAX_EMAIL_ATTEMPTS)
    .gte("scheduled_for", deadLetterFloorISO);
  if ((deadLetterCount ?? 0) > 0) {
    logError(`dispatch: ${deadLetterCount} notification email(s) dead-lettered (>= ${MAX_EMAIL_ATTEMPTS} failed attempts in last ${DEAD_LETTER_WINDOW_HOURS}h)`);
  }

  const counts = {
    checked: due?.length ?? 0,
    delivered,
    canceled,
    deferred,
    emailsSent,
    emailRetries,
    emailFailures,
    deadLetter: deadLetterCount ?? 0,
  };
  try {
    await admin.from("dispatch_health").upsert(
      { id: 1, last_ok_at: new Date().toISOString(), last_error: null, last_counts: counts },
      { onConflict: "id" },
    );
  } catch { /* best-effort */ }

  return new Response(
    JSON.stringify(missedRunsSince ? { ...counts, missedRunsSince } : counts),
    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
  );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logError("dispatch run failed:", msg);
    try {
      await admin.from("dispatch_health").upsert({ id: 1, last_error: msg }, { onConflict: "id" });
    } catch { /* best-effort */ }
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
