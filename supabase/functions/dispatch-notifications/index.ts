// Cron-driven dispatcher. Picks pending notifications whose scheduled_for has passed,
// re-validates the underlying invoice, respects user preferences + quiet hours,
// then marks them delivered. Real email/push wiring is left for a follow-up pass.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function hourInTimezone(tz: string): number {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false });
    return parseInt(fmt.format(new Date()), 10);
  } catch {
    return new Date().getUTCHours();
  }
}

function isQuietHour(hour: number, start: number, end: number): boolean {
  // Handles wrap-around (e.g. 21 -> 8)
  if (start === end) return false;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const nowISO = new Date().toISOString();
  const { data: due, error } = await admin
    .from("notifications")
    .select("id, user_id, invoice_id, type, title, body, scheduled_for, attempts")
    .eq("status", "pending")
    .lte("scheduled_for", nowISO)
    .limit(200);

  if (error) {
    console.error("Fetch pending failed:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let delivered = 0;
  let canceled = 0;
  let deferred = 0;

  for (const n of due ?? []) {
    // Validate invoice still exists and is unpaid
    const { data: inv } = await admin
      .from("invoices")
      .select("id, status")
      .eq("id", n.invoice_id)
      .maybeSingle();
    if (!inv || inv.status === "Paid") {
      await admin.from("notifications").update({ status: "canceled" }).eq("id", n.id);
      canceled++;
      continue;
    }

    // Fetch user prefs (defaults if missing)
    const { data: prefs } = await admin
      .from("notification_preferences")
      .select("enabled, quiet_hours_start, quiet_hours_end, timezone")
      .eq("user_id", n.user_id)
      .maybeSingle();

    const enabled = prefs?.enabled ?? false;
    const tz = prefs?.timezone ?? "UTC";
    const qStart = prefs?.quiet_hours_start ?? 21;
    const qEnd = prefs?.quiet_hours_end ?? 8;

    if (!enabled) {
      // Still record in inbox so user sees history when they enable
      await admin
        .from("notifications")
        .update({ status: "delivered", delivered_at: new Date().toISOString() })
        .eq("id", n.id);
      delivered++;
      continue;
    }

    if (isQuietHour(hourInTimezone(tz), qStart, qEnd)) {
      deferred++;
      continue; // try again next cycle
    }

    await admin
      .from("notifications")
      .update({ status: "delivered", delivered_at: new Date().toISOString(), attempts: (n.attempts ?? 0) + 1 })
      .eq("id", n.id);
    delivered++;
  }

  return new Response(
    JSON.stringify({ checked: due?.length ?? 0, delivered, canceled, deferred }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
  );
});
