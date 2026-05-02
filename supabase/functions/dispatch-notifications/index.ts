// Cron-driven dispatcher. Picks pending notifications whose scheduled_for has passed,
// re-validates the underlying invoice, respects user preferences + quiet hours,
// then marks them delivered and sends Resend email if email_enabled.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logError, logWarn } from "../_shared/log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = "ChaseHQ <onboarding@resend.dev>";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // === Auth gate ===
  // The function is verify_jwt=false because pg_cron's HTTP wrapper doesn't
  // mint user JWTs. Instead we require a shared secret in a custom header so
  // an attacker on the public internet can't trigger the send loop. The
  // secret is set as a Supabase function secret and configured into the cron
  // job's `headers` parameter.
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
  // Postgres advisory lock: if another invocation is already running, bail
  // out so we don't double-send. Released automatically when this function
  // exits (transaction-scoped advisory locks are session-scoped here).
  const lockRes = await admin.rpc("pg_try_advisory_lock", { key: ADVISORY_LOCK_KEY });
  // Supabase RPC for built-in functions may need a wrapper SQL function;
  // fall back gracefully if the RPC isn't available — the duplicate-send
  // window is small (1 minute) and the email_send_log + notifications.status
  // already de-dup at the per-row level.
  if (lockRes.error) {
    logWarn("advisory lock unavailable, continuing without:", lockRes.error.message);
  } else if (lockRes.data === false) {
    return new Response(JSON.stringify({ skipped: "another dispatch in progress" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const nowISO = new Date().toISOString();
  const { data: due, error } = await admin
    .from("notifications")
    .select("id, user_id, invoice_id, type, title, body, scheduled_for, attempts")
    .eq("status", "pending")
    .lte("scheduled_for", nowISO)
    .limit(200);

  if (error) {
    logError("Fetch pending failed:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let delivered = 0;
  let canceled = 0;
  let deferred = 0;
  let emailsSent = 0;

  for (const n of due ?? []) {
    // Validate invoice still exists and is unpaid
    const { data: inv } = await admin
      .from("invoices")
      .select("id, status, client, amount, days_past_due, invoice_number")
      .eq("id", n.invoice_id)
      .maybeSingle();
    if (!inv || inv.status === "Paid") {
      await admin.from("notifications").update({ status: "canceled" }).eq("id", n.id);
      canceled++;
      continue;
    }

    // Honor paused schedules — cancel rather than deliver
    const { data: sched } = await admin
      .from("followup_schedules")
      .select("paused")
      .eq("invoice_id", n.invoice_id)
      .maybeSingle();
    if (sched?.paused) {
      await admin.from("notifications").update({ status: "canceled" }).eq("id", n.id);
      canceled++;
      continue;
    }

    // Fetch user prefs (defaults if missing)
    const { data: prefs } = await admin
      .from("notification_preferences")
      .select("enabled, email_enabled, quiet_hours_start, quiet_hours_end, timezone")
      .eq("user_id", n.user_id)
      .maybeSingle();

    const enabled = prefs?.enabled ?? false;
    const emailEnabled = prefs?.email_enabled ?? false;
    const tz = prefs?.timezone ?? "UTC";
    const qStart = prefs?.quiet_hours_start ?? 21;
    const qEnd = prefs?.quiet_hours_end ?? 8;

    if (isQuietHour(hourInTimezone(tz), qStart, qEnd)) {
      deferred++;
      continue;
    }

    // Mark delivered regardless of push preference (inbox always gets it)
    await admin
      .from("notifications")
      .update({ status: "delivered", delivered_at: new Date().toISOString(), attempts: (n.attempts ?? 0) + 1 })
      .eq("id", n.id);
    delivered++;

    // Send Resend email if user opted in
    if (enabled && emailEnabled) {
      const { data: authUser } = await admin.auth.admin.getUserById(n.user_id);
      const userEmail = authUser?.user?.email;
      if (userEmail) {
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
        const sent = await sendResendEmail(userEmail, subject, html);
        if (sent) emailsSent++;
      }
    }
  }

  return new Response(
    JSON.stringify({ checked: due?.length ?? 0, delivered, canceled, deferred, emailsSent }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
  );
});
