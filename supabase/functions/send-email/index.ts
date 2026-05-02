import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

import { buildCors } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitedResponse } from "../_shared/rate_limit.ts";

type Json = (body: unknown, status?: number) => Response;

// Verifies a Supabase JWT locally — handles both legacy HS256 and new ES256 (ECC P-256) keys.
// Falls back to the admin getUser API if local verification fails.
async function verifySupabaseJWT(token: string, supabaseUrl: string): Promise<string | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const decode = (s: string) =>
      JSON.parse(new TextDecoder().decode(
        Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0))
      ));
    const header = decode(parts[0]);
    const payload = decode(parts[1]);
    if (!payload.sub) return null;
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;

    const signingInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const sig = Uint8Array.from(atob(parts[2].replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));

    if (header.alg === "HS256") {
      const secret = Deno.env.get("SUPABASE_JWT_SECRET");
      if (!secret) return null;
      const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
      if (!await crypto.subtle.verify("HMAC", key, sig, signingInput)) return null;
    } else if (header.alg === "ES256") {
      const jwksRes = await fetch(`${supabaseUrl}/auth/v1/.well-known/jwks.json`);
      if (!jwksRes.ok) return null;
      const { keys } = await jwksRes.json();
      const jwk = keys.find((k: any) => !header.kid || k.kid === header.kid) ?? keys[0];
      if (!jwk) return null;
      const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
      if (!await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, sig, signingInput)) return null;
    } else {
      return null;
    }
    return payload.sub as string;
  } catch {
    return null;
  }
}

// Per-user daily send cap.
const DAILY_SEND_CAP = 50;

serve(async (req) => {
  const cors = buildCors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const json: Json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  try {
    const { to, subject, message, invoiceId } = await req.json();
    if (!to || !subject || !message) {
      return json({ error: "Missing to, subject, or message" }, 400);
    }
    // Basic email shape check — defence in depth, client also validates.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(to))) {
      return json({ error: "Invalid recipient email" }, 400);
    }

    // X-User-Token carries the real ES256 user JWT (the platform only checks Authorization,
    // so we route around the broken ES256 platform validator by sending the anon key there
    // and the user's token in this custom header).
    const userToken = req.headers.get("X-User-Token") ??
      req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!userToken) return json({ error: "Not authenticated" }, 401);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = userToken;
    const userId = await verifySupabaseJWT(token, Deno.env.get("SUPABASE_URL")!);
    if (!userId) return json({ error: "Invalid session" }, 401);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (authError || !user) return json({ error: "Invalid session" }, 401);

    // Defense-in-depth per-user/minute ceiling on top of the 50/day cap below.
    // Cheap to apply, blocks burst abuse from a stolen JWT before the daily count catches up.
    const rl = await checkRateLimit(supabaseAdmin, user.id, "send-email", 30);
    if (!rl.allowed) return rateLimitedResponse(cors);

    const senderName: string =
      user.user_metadata?.full_name ??
      user.user_metadata?.name ??
      "";

    // === Subscription gate: entitled OR no followups sent yet (one free send) ===
    const { data: hasEnt, error: entErr } = await supabaseAdmin
      .rpc("has_active_entitlement", { _user_id: user.id });
    if (entErr) {
      console.error("entitlement check error:", entErr);
      return json({ error: "subscription_required", message: "Could not verify subscription. Please try again." });
    }

    let canSend = !!hasEnt;
    if (!canSend) {
      const { count: followupsCount, error: countErr } = await supabaseAdmin
        .from("followups")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      if (!countErr) canSend = (followupsCount ?? 0) === 0;
    }

    if (!canSend) {
      return json({ error: "subscription_required", message: "Your trial has ended. Subscribe to keep sending follow-ups." });
    }

    // === Per-user daily rate limit ===
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: sendCount, error: countErr } = await supabaseAdmin
      .from("email_send_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("sent_at", since);
    if (countErr) {
      console.error("rate-limit count error:", countErr);
    } else if ((sendCount ?? 0) >= DAILY_SEND_CAP) {
      return json({
        error: "rate_limited",
        message: `You've hit today's limit of ${DAILY_SEND_CAP} sends. Try again tomorrow.`,
      });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("sender_type")
      .eq("user_id", user.id)
      .maybeSingle();

    let senderType: "gmail" | "smtp" | "none" = (profile?.sender_type as any) ?? "none";

    if (senderType === "none") {
      const { data: gm } = await supabaseAdmin.from("gmail_connections").select("user_id").eq("user_id", user.id).maybeSingle();
      if (gm) senderType = "gmail";
      else {
        const { data: sm } = await supabaseAdmin.from("smtp_connections").select("user_id").eq("user_id", user.id).maybeSingle();
        if (sm) senderType = "smtp";
      }
    }

    let result: Response;
    if (senderType === "gmail") {
      result = await sendViaGmail(supabaseAdmin, user.id, to, subject, message, senderName, json);
    } else if (senderType === "smtp") {
      result = await sendViaSmtp(supabaseAdmin, user.id, to, subject, message, json);
    } else {
      return json({ error: "no_mailbox", message: "No sending mailbox connected." });
    }

    // Log successful sends only (status 2xx).
    if (result.status >= 200 && result.status < 300) {
      await supabaseAdmin.from("email_send_log").insert({
        user_id: user.id,
        recipient: to,
        invoice_id: invoiceId ?? null,
      });
    }
    return result;
  } catch (e) {
    console.error("send-email error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

async function sendViaGmail(supabaseAdmin: any, userId: string, to: string, subject: string, message: string, senderName: string, json: Json) {
  const { data: gmailConn, error: connError } = await supabaseAdmin
    .from("gmail_connections")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (connError || !gmailConn) {
    return json({ error: "no_mailbox", message: "Gmail not connected. Please connect Gmail in Settings." });
  }

  let accessToken = gmailConn.access_token;
  const expiresAt = new Date(gmailConn.token_expires_at).getTime();
  if (Date.now() > expiresAt - 5 * 60 * 1000) {
    const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!;
    const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: gmailConn.refresh_token,
        grant_type: "refresh_token",
      }),
    });
    const refreshData = await refreshRes.json();
    if (!refreshRes.ok || !refreshData.access_token) {
      console.error("Token refresh failed");
      return json({ error: "no_mailbox", message: "Gmail token expired. Please reconnect Gmail in Settings." });
    }
    accessToken = refreshData.access_token;
    const newExpiry = new Date(Date.now() + (refreshData.expires_in || 3600) * 1000).toISOString();
    await supabaseAdmin.from("gmail_connections").update({
      access_token: accessToken,
      token_expires_at: newExpiry,
    }).eq("user_id", userId);
  }

  const emailLines = [
    `To: ${to}`,
    `From: ${senderName ? `${senderName} <${gmailConn.email}>` : gmailConn.email}`,
    `Subject: ${subject}`,
    `Content-Type: text/plain; charset=utf-8`,
    "",
    message,
  ];
  const rawEmail = emailLines.join("\r\n");
  const encoder = new TextEncoder();
  const data = encoder.encode(rawEmail);
  // btoa(String.fromCharCode(...data)) overflows the call stack for large messages.
  // Chunk the array to stay within argument limits.
  let binary = "";
  const CHUNK = 8192;
  for (let i = 0; i < data.length; i += CHUNK) {
    binary += String.fromCharCode(...data.subarray(i, i + CHUNK));
  }
  const base64 = btoa(binary)
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const gmailResponse = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw: base64 }),
    }
  );

  if (!gmailResponse.ok) {
    const status = gmailResponse.status;
    const errBody = await gmailResponse.json().catch(() => null);
    console.error("Gmail API error:", status, JSON.stringify(errBody));
    if (status === 401) {
      return json({ error: "no_mailbox", message: "Gmail token expired. Please reconnect Gmail in Settings." });
    }
    return json({ error: "Failed to send email via Gmail", gmailStatus: status, gmailError: errBody }, 500);
  }
  const result = await gmailResponse.json();
  return json({ success: true, messageId: result.id, via: "gmail" });
}

async function sendViaSmtp(supabaseAdmin: any, userId: string, to: string, subject: string, message: string, json: Json) {
  const { data: conn, error } = await supabaseAdmin
    .from("smtp_connections").select("*").eq("user_id", userId).maybeSingle();
  if (error || !conn) {
    return json({ error: "no_mailbox", message: "SMTP not connected. Please connect your email in Settings." });
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
  } catch (err) {
    await client.close().catch(() => {});
    // Log only the error name/type, not the full message which may include credentials.
    const safeName = err instanceof Error ? err.name : "UnknownSmtpError";
    console.error("SMTP send error:", safeName);
    return json({ error: "SMTP send failed" }, 500);
  }
  await client.close();
  return json({ success: true, via: "smtp" });
}

