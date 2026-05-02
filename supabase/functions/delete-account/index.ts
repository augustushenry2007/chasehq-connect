import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { buildCors } from "../_shared/cors.ts";

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

    // Delete all user data in dependency order (children first)
    const userId = user.id;
    await admin.from("notifications").delete().eq("user_id", userId);
    await admin.from("followup_schedules").delete().eq("user_id", userId);
    await admin.from("notification_preferences").delete().eq("user_id", userId);
    await admin.from("email_send_log").delete().eq("user_id", userId);
    await admin.from("followups").delete().eq("user_id", userId);
    await admin.from("invoices").delete().eq("user_id", userId);
    await admin.from("gmail_connections").delete().eq("user_id", userId);
    await admin.from("smtp_connections").delete().eq("user_id", userId);
    await admin.from("subscription_events").delete().eq("user_id", userId);
    await admin.from("subscriptions").delete().eq("user_id", userId);
    await admin.from("profiles").delete().eq("user_id", userId);

    // Delete the auth user — requires service role
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("delete-account: auth.admin.deleteUser failed:", deleteError.message);
      return json({ error: "Failed to delete account: " + deleteError.message }, 500);
    }

    return json({ ok: true });
  } catch (e) {
    console.error("delete-account error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

