import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

import { buildCors } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitedResponse } from "../_shared/rate_limit.ts";

serve(async (req) => {
  const cors = buildCors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  try {
    const { to, subject, message } = await req.json();
    if (!to || !subject || !message) {
      return json({ error: "Missing to, subject, or message" }, 400);
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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Per-user/minute ceiling. SMTP costs nothing on our side, but a stolen JWT
    // could spam through someone's mail server — this caps that blast radius.
    const rl = await checkRateLimit(supabaseAdmin, user.id, "smtp-send", 30);
    if (!rl.allowed) return rateLimitedResponse(cors);
    const { data: conn, error: connError } = await supabaseAdmin
      .from("smtp_connections")
      .select("smtp_host, smtp_port, smtp_username, from_email, from_name, smtp_password_secret_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (connError || !conn) {
      return json({ error: "SMTP not connected. Please connect your email in Settings." }, 401);
    }

    const { data: smtpPassword, error: vaultErr } = await supabaseAdmin
      .rpc("vault_read_secret", { p_id: conn.smtp_password_secret_id });
    if (vaultErr || !smtpPassword) {
      console.error("smtp-send vault read error:", vaultErr);
      return json({ error: "Failed to retrieve SMTP credentials" }, 500);
    }

    const client = new SMTPClient({
      connection: {
        hostname: conn.smtp_host,
        port: conn.smtp_port,
        tls: conn.smtp_port === 465,
        auth: { username: conn.smtp_username, password: smtpPassword },
      },
    });

    try {
      await client.send({
        from: conn.from_name ? `${conn.from_name} <${conn.from_email}>` : conn.from_email,
        to,
        subject,
        content: message,
      });
    } finally {
      await client.close();
    }

    return json({ success: true });
  } catch (e) {
    console.error("smtp-send error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

