import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { buildCors } from "../_shared/cors.ts";
import { logError } from "../_shared/log.ts";

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

    // Delete the auth user. Every user-scoped table carries an
    // `ON DELETE CASCADE` FK to auth.users(id) — invoices, followups,
    // followup_schedules, notifications, notification_preferences,
    // subscriptions, subscription_events, profiles, email_send_log — so this
    // one delete tears down everything in a single transactional cascade.
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
