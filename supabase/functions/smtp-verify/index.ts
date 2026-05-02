import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

import { buildCors } from "../_shared/cors.ts";

serve(async (req) => {
  const cors = buildCors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { from_email, from_name, smtp_host, smtp_port, smtp_username, smtp_password } = await req.json();
    if (!from_email || !smtp_host || !smtp_port || !smtp_username || !smtp_password) {
      return json({ error: "Missing required fields" }, 400);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Not authenticated" }, 401);

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return json({ error: "Invalid session" }, 401);

    // Try to open & close an SMTP connection to verify credentials
    const port = Number(smtp_port);
    const client = new SMTPClient({
      connection: {
        hostname: smtp_host,
        port,
        tls: port === 465,
        auth: { username: smtp_username, password: smtp_password },
      },
    });
    try {
      // denomailer connects lazily on send, so do a no-op send check by closing.
      // To force auth, send to self with a tiny probe? Simpler: just close — auth happens on first send.
      // We'll do a send to the user's own address (from_email) as the verification probe.
      await client.send({
        from: from_name ? `${from_name} <${from_email}>` : from_email,
        to: from_email,
        subject: "ChaseHQ — connection verified",
        content: "Your ChaseHQ SMTP connection is working. You can ignore this message.",
      });
    } catch (err) {
      await client.close().catch(() => {});
      return json({ verified: false, error: err instanceof Error ? err.message : "Verification failed" }, 200);
    }
    await client.close();

    // Save (upsert) connection as verified
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { error: upsertError } = await supabaseAdmin
      .from("smtp_connections")
      .upsert({
        user_id: user.id,
        from_email,
        from_name: from_name || null,
        smtp_host,
        smtp_port: port,
        smtp_username,
        smtp_password,
        verified: true,
      }, { onConflict: "user_id" });

    if (upsertError) {
      console.error("smtp-verify db upsert error:", upsertError);
      return json({ error: "Failed to save connection" }, 500);
    }

    // Set sender_type to smtp if not already set
    await supabaseAdmin
      .from("profiles")
      .update({ sender_type: "smtp" })
      .eq("user_id", user.id)
      .eq("sender_type", "none");

    return json({ verified: true });
  } catch (e) {
    console.error("smtp-verify error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
