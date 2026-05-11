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

// Returns true if the IPv4/IPv6 string falls in a loopback / private / link-local /
// CGNAT / metadata range. Best-effort: covers the ranges an SSRF attacker would target.
function isPrivateIp(ip: string): boolean {
  // IPv4-mapped IPv6 (::ffff:1.2.3.4) → check the embedded v4
  const mapped = ip.match(/::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  if (mapped) return isPrivateIp(mapped[1]);

  if (ip.includes(":")) {
    const lc = ip.toLowerCase();
    if (lc === "::1" || lc === "::") return true;        // loopback / unspecified
    if (lc.startsWith("fe80")) return true;              // link-local
    if (lc.startsWith("fc") || lc.startsWith("fd")) return true; // unique-local (fc00::/7)
    if (lc.startsWith("64:ff9b:")) return true;          // NAT64
    return false;
  }

  const parts = ip.split(".").map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true; // malformed → reject
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;                 // "this", private-10, loopback
  if (a === 169 && b === 254) return true;                           // link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;                  // private-172
  if (a === 192 && b === 168) return true;                           // private-192
  if (a === 100 && b >= 64 && b <= 127) return true;                 // CGNAT (100.64.0.0/10)
  if (a === 192 && b === 0 && parts[2] === 0) return true;           // IETF protocol assignments
  if (a === 198 && (b === 18 || b === 19)) return true;              // benchmarking
  if (a >= 224) return true;                                        // multicast + reserved
  return false;
}

// Resolve a hostname's A/AAAA records and reject if ANY answer is a private/loopback
// IP. This is the resolved-IP check that the string blocklist above can't do — a
// public domain whose record points at 10.x / 169.254.169.254 would otherwise slip
// through. Best-effort (DNS can rebind between this check and denomailer's own
// resolution), so it's defence in depth on top of the port + hostname-string limits.
async function resolvesToPrivate(host: string): Promise<boolean> {
  for (const kind of ["A", "AAAA"] as const) {
    try {
      const recs = await Deno.resolveDns(host, kind);
      for (const r of recs) {
        if (isPrivateIp(r)) return true;
      }
    } catch {
      // NXDOMAIN / no AAAA / resolver error — fine, try the other record type.
    }
  }
  // Zero answers (or only CNAME chains we didn't follow) → let denomailer surface
  // the resolution result rather than hard-failing a possibly-valid host here.
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
    if (await resolvesToPrivate(host)) {
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
    const { error: upsertError } = await supabaseAdmin.rpc("upsert_smtp_connection", {
      p_user_id:       user.id,
      p_from_email:    from_email,
      p_from_name:     from_name || null,
      p_smtp_host:     host,
      p_smtp_port:     port,
      p_smtp_username: smtp_username,
      p_smtp_password: smtp_password,
      p_verified:      true,
    });

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
