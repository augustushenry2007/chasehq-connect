import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

import { buildCors } from "../_shared/cors.ts";
import { logError } from "../_shared/log.ts";

const ALLOWED_PORTS = new Set([25, 465, 587, 2525]);
const HOSTNAME_RE = /^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?)+$/i;

// Reject obvious internal-network hostnames. Defense in depth — denomailer
// does its own DNS resolution and we don't want a user-supplied smtp_host to
// turn this function into an SSRF probe (or a credential exfiltration vector
// to an attacker-controlled SMTP listening on a private subnet).
function isPrivateHostname(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local")) return true;
  if (h.endsWith(".internal") || h.endsWith(".intra") || h.endsWith(".lan")) return true;
  // IPv4 literal (any) — we forbid IP literals outright to keep the surface small.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return true;
  // IPv6 literal in URL form
  if (h.startsWith("[") || h.includes("::")) return true;
  return false;
}

function isValidEmail(s: unknown): s is string {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
}

serve(async (req) => {
  const cors = buildCors(req.headers.get("origin"));
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { from_email, from_name, smtp_host, smtp_port, smtp_username, smtp_password } = await req.json();
    if (!from_email || !smtp_host || !smtp_port || !smtp_username || !smtp_password) {
      return json({ error: "Missing required fields" }, 400);
    }
    if (!isValidEmail(from_email)) {
      return json({ error: "Invalid from_email" }, 400);
    }

    // --- Hostname validation ---
    const host = String(smtp_host).trim();
    if (host.length > 255 || !HOSTNAME_RE.test(host)) {
      return json({ error: "Invalid SMTP hostname" }, 400);
    }
    if (isPrivateHostname(host)) {
      return json({ error: "SMTP host must be a public mail server" }, 400);
    }

    // --- Port validation ---
    const port = Number(smtp_port);
    if (!Number.isInteger(port) || !ALLOWED_PORTS.has(port)) {
      return json({ error: "SMTP port must be 25, 465, 587, or 2525" }, 400);
    }

    // --- Length caps on credentials (denomailer doesn't sanitize) ---
    if (typeof smtp_username !== "string" || smtp_username.length > 256) {
      return json({ error: "Invalid smtp_username" }, 400);
    }
    if (typeof smtp_password !== "string" || smtp_password.length > 1024) {
      return json({ error: "Invalid smtp_password" }, 400);
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

    const client = new SMTPClient({
      connection: {
        hostname: host,
        port,
        tls: port === 465,
        auth: { username: smtp_username, password: smtp_password },
      },
    });
    try {
      await client.send({
        from: from_name ? `${from_name} <${from_email}>` : from_email,
        to: from_email,
        subject: "ChaseHQ — connection verified",
        content: "Your ChaseHQ SMTP connection is working. You can ignore this message.",
      });
    } catch (err) {
      await client.close().catch(() => {});
      // Don't echo SMTP server banners back to the client — they can leak
      // server vendor / version / internal IPs. Log full detail server-side
      // (with redaction), return only a generic failure to the caller.
      const safeName = err instanceof Error ? err.name : "UnknownSmtpError";
      logError("smtp-verify failed:", safeName);
      return json({ verified: false, error: "SMTP verification failed" }, 200);
    }
    await client.close();

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
        smtp_host: host,
        smtp_port: port,
        smtp_username,
        smtp_password,
        verified: true,
      }, { onConflict: "user_id" });

    if (upsertError) {
      logError("smtp-verify db upsert error:", upsertError);
      return json({ error: "Failed to save connection" }, 500);
    }

    await supabaseAdmin
      .from("profiles")
      .update({ sender_type: "smtp" })
      .eq("user_id", user.id)
      .eq("sender_type", "none");

    return json({ verified: true });
  } catch (e) {
    logError("smtp-verify error:", e);
    return json({ error: "Unknown error" }, 500);
  }
});
