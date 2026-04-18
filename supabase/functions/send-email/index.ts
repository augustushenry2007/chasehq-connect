import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Per-user daily send cap.
const DAILY_SEND_CAP = 50;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { to, subject, message, invoiceId } = await req.json();
    if (!to || !subject || !message) {
      return json({ error: "Missing to, subject, or message" }, 400);
    }
    // Basic email shape check — defence in depth, client also validates.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(to))) {
      return json({ error: "Invalid recipient email" }, 400);
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

    // === Subscription gate ===
    const { data: hasEnt, error: entErr } = await supabaseAdmin
      .rpc("has_active_entitlement", { _user_id: user.id });
    if (entErr) {
      console.error("entitlement check error:", entErr);
      return json({ error: "Could not verify subscription" }, 500);
    }
    if (!hasEnt) {
      return json({ error: "subscription_required", message: "Your trial has ended. Subscribe to keep sending follow-ups." }, 402);
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
      }, 429);
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
      result = await sendViaGmail(supabaseAdmin, user.id, to, subject, message);
    } else if (senderType === "smtp") {
      result = await sendViaSmtp(supabaseAdmin, user.id, to, subject, message);
    } else {
      return json({ error: "no_mailbox", message: "No sending mailbox connected." }, 400);
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

async function sendViaGmail(supabaseAdmin: any, userId: string, to: string, subject: string, message: string) {
  const { data: gmailConn, error: connError } = await supabaseAdmin
    .from("gmail_connections")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (connError || !gmailConn) {
    return json({ error: "no_mailbox", message: "Gmail not connected. Please connect Gmail in Settings." }, 401);
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
      return json({ error: "no_mailbox", message: "Gmail token expired. Please reconnect Gmail in Settings." }, 401);
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
    `Subject: ${subject}`,
    `Content-Type: text/plain; charset=utf-8`,
    "",
    message,
  ];
  const rawEmail = emailLines.join("\r\n");
  const encoder = new TextEncoder();
  const data = encoder.encode(rawEmail);
  const base64 = btoa(String.fromCharCode(...data))
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
    // Don't log raw body to avoid leaking tokens / sensitive context.
    console.error("Gmail API error status:", status);
    if (status === 401) {
      return json({ error: "no_mailbox", message: "Gmail token expired. Please reconnect Gmail in Settings." }, 401);
    }
    return json({ error: "Failed to send email via Gmail" }, 500);
  }
  const result = await gmailResponse.json();
  return json({ success: true, messageId: result.id, via: "gmail" });
}

async function sendViaSmtp(supabaseAdmin: any, userId: string, to: string, subject: string, message: string) {
  const { data: conn, error } = await supabaseAdmin
    .from("smtp_connections").select("*").eq("user_id", userId).maybeSingle();
  if (error || !conn) {
    return json({ error: "no_mailbox", message: "SMTP not connected. Please connect your email in Settings." }, 401);
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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
