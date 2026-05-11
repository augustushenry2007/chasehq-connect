import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { buildCors } from "../_shared/cors.ts";
import { logError, logWarn } from "../_shared/log.ts";

serve(async (req) => {
  const cors = buildCors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

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

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const userId = user.id;

    // Best-effort: revoke the user's Gmail OAuth grant at Google before we drop
    // the connection row. The DB delete alone would leave the refresh token live
    // at Google until the user manually removes the app — closing that window is
    // part of honoring the deletion request. A failed revoke must not block the
    // rest of the teardown.
    try {
      const { data: conn } = await admin
        .from("gmail_connections")
        .select("refresh_token_secret_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (conn?.refresh_token_secret_id) {
        const { data: refreshToken } = await admin
          .rpc("vault_read_secret", { p_id: conn.refresh_token_secret_id });
        if (refreshToken) {
          const res = await fetch(
            `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`,
            { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" } }
          );
          if (!res.ok) logWarn("delete-account: gmail revoke non-2xx", res.status);
        }
      }
    } catch (e) {
      logWarn("delete-account: gmail revoke step failed (continuing):", e);
    }

    // Delete the auth user. Every user-scoped table now carries an
    // `ON DELETE CASCADE` FK to auth.users(id) — invoices, followups,
    // followup_schedules, notifications, notification_preferences,
    // smtp_connections, gmail_connections, subscriptions, subscription_events,
    // profiles, email_send_log — so this one delete tears down everything in a
    // single transactional cascade. (The old approach ran 11 sequential deletes
    // with no error checks: a transport throw mid-list left a half-deleted
    // account the user could sign back into, and a silently-failed delete left
    // orphans.) Run it last so the Gmail-revoke step above still sees the
    // connection row.
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) {
      logError("delete-account: auth.admin.deleteUser failed:", deleteError.message);
      return json({ error: "Failed to delete account" }, 500);
    }

    return json({ ok: true });
  } catch (e) {
    logError("delete-account error:", e);
    return json({ error: "Internal error" }, 500);
  }
});
