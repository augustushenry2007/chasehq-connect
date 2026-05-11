import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { buildCors } from "../_shared/cors.ts";
import { logError } from "../_shared/log.ts";

// Disconnects a user's Gmail connection: revokes the refresh token at Google,
// then deletes the gmail_connections row. The DB delete alone would leave the
// token live at Google until natural expiry; this closes that window.
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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: conn } = await supabaseAdmin
      .from("gmail_connections")
      .select("refresh_token_secret_id")
      .eq("user_id", user.id)
      .maybeSingle();

    // Best-effort revoke at Google. We continue with the row delete either way —
    // the user's intent is to disconnect, and a failed revocation shouldn't trap them.
    if (conn?.refresh_token_secret_id) {
      const { data: refreshToken } = await supabaseAdmin
        .rpc("vault_read_secret", { p_id: conn.refresh_token_secret_id });
      if (refreshToken) {
        try {
          const res = await fetch(
            `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`,
            { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" } }
          );
          if (!res.ok) logError("gmail revoke non-2xx", res.status);
        } catch (e) {
          logError("gmail revoke fetch error:", e);
        }
      }
    }

    const { error: delErr } = await supabaseAdmin
      .from("gmail_connections")
      .delete()
      .eq("user_id", user.id);
    if (delErr) {
      logError("disconnect-gmail row delete error:", delErr);
      return json({ error: "Could not disconnect" }, 500);
    }

    return json({ success: true });
  } catch (e) {
    logError("disconnect-gmail error:", e);
    return json({ error: "Internal error" }, 500);
  }
});
