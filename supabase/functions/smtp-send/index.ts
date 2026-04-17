import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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
    const { data: conn, error: connError } = await supabaseAdmin
      .from("smtp_connections")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (connError || !conn) {
      return json({ error: "SMTP not connected. Please connect your email in Settings." }, 401);
    }

    const client = new SMTPClient({
      connection: {
        hostname: conn.smtp_host,
        port: conn.smtp_port,
        tls: conn.smtp_port === 465,
        auth: { username: conn.smtp_username, password: conn.smtp_password },
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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
