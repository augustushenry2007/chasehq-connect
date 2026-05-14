import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCors, preflight } from "../_shared/cors.ts";
import { logError } from "../_shared/log.ts";
import { buildUnsubscribeHeaders } from "../_shared/unsubscribe.ts";
import { isRecipientSuppressed } from "../_shared/suppression.ts";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const RESEND_API_KEY = Deno.env.get("RESEND_KEY_TRANSACTIONAL")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight(req);

  const cors = buildCors(req.headers.get("origin"));

  const auth = req.headers.get("Authorization") ?? "";
  if (auth !== `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`) {
    return new Response("Unauthorized", { status: 401, headers: cors });
  }

  let payload: { record?: { user_id?: string; full_name?: string | null } };
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400, headers: cors });
  }

  const record = payload.record;
  if (!record?.user_id) {
    return new Response("Missing user_id", { status: 400, headers: cors });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: { user }, error } = await admin.auth.admin.getUserById(record.user_id);
  if (error || !user?.email) {
    logError("[send-welcome-email] user lookup failed:", error?.message);
    return new Response("User not found", { status: 404, headers: cors });
  }

  // Respect prior unsubscribe / bounce / complaint. A re-signup from a
  // previously-suppressed address shouldn't auto-resume welcome mail.
  if (await isRecipientSuppressed(admin, user.email)) {
    return new Response(JSON.stringify({ ok: true, skipped: "suppressed" }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // First name from Google-provided full_name; fall back to "there" if absent.
  // Email prefix is intentionally NOT used — it produces garbage like "agushenry2007".
  // Escaped because full_name ultimately derives from a profiles row that users can edit.
  const firstName = escapeHtml((record.full_name ?? "").trim().split(/\s+/)[0] || "there");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "ChaseHQ <noreply@chasehq.app>",
      reply_to: "support@chasehq.app",
      to: [user.email],
      subject: "Welcome to ChaseHQ",
      html: buildEmail(firstName),
      headers: await buildUnsubscribeHeaders(user.email),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    logError("[send-welcome-email] Resend error:", body.slice(0, 300));
    return new Response("Email send failed", { status: 500, headers: cors });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});

function buildEmail(firstName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to ChaseHQ</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.07);">

          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px;border-bottom:1px solid #eef0f2;">
              <span style="font-size:22px;font-weight:700;letter-spacing:-0.03em;color:#1a2b35;">Chase<span style="color:#3b82f6;">HQ</span></span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 28px;">
              <p style="margin:0 0 16px;font-size:17px;color:#1a2b35;line-height:1.5;">
                Hi ${firstName},
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.65;">
                No more dreading the follow-up email. Add your first overdue invoice and ChaseHQ will draft the message — you just approve and send.
              </p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:9999px;background:#3b82f6;">
                    <a href="https://chasehq.app" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:-0.01em;">
                      Open ChaseHQ →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 28px;border-top:1px solid #eef0f2;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
                Questions? Reply to this email or reach us at
                <a href="mailto:support@chasehq.app" style="color:#6b7280;text-decoration:underline;">support@chasehq.app</a>.<br />
                You received this because you created a ChaseHQ account. This is a one-time welcome message.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
