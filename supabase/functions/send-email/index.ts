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

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("sender_type")
      .eq("user_id", user.id)
      .maybeSingle();

    let senderType: "gmail" | "smtp" | "none" = (profile?.sender_type as any) ?? "none";

    // Auto-resolve if 'none' but a connection exists
    if (senderType === "none") {
      const { data: gm } = await supabaseAdmin.from("gmail_connections").select("user_id").eq("user_id", user.id).maybeSingle();
      if (gm) senderType = "gmail";
      else {
        const { data: sm } = await supabaseAdmin.from("smtp_connections").select("user_id").eq("user_id", user.id).maybeSingle();
        if (sm) senderType = "smtp";
      }
    }

    if (senderType === "gmail") {
      return await sendViaGmail(supabaseAdmin, user.id, to, subject, message);
    }
    if (senderType === "smtp") {
      return await sendViaSmtp(supabaseAdmin, user.id, to, subject, message);
    }

    return json({ error: "No sending mailbox connected. Please connect Gmail or your email in Settings." }, 400);
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
    return json({ error: "Gmail not connected. Please connect Gmail in Settings." }, 401);
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
      console.error("Token refresh failed:", refreshData);
      return json({ error: "Gmail token expired. Please reconnect Gmail in Settings." }, 401);
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
    const errorText = await gmailResponse.text();
    console.error("Gmail API error:", gmailResponse.status, errorText);
    if (gmailResponse.status === 401) {
      return json({ error: "Gmail token expired. Please reconnect Gmail in Settings." }, 401);
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
  } catch (err) {
    await client.close().catch(() => {});
    console.error("SMTP send error:", err);
    return json({ error: err instanceof Error ? err.message : "SMTP send failed" }, 500);
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
