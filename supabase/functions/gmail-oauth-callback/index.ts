import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      return new Response(buildRedirectHtml("", false, "Google authorization was denied"), {
        status: 200, headers: { "Content-Type": "text/html" },
      });
    }

    if (!code || !stateParam) {
      return new Response(buildRedirectHtml("", false, "Missing authorization code"), {
        status: 400, headers: { "Content-Type": "text/html" },
      });
    }

    let state: { userId: string; redirectUri: string };
    try {
      state = JSON.parse(atob(stateParam));
    } catch {
      return new Response(buildRedirectHtml("", false, "Invalid state parameter"), {
        status: 400, headers: { "Content-Type": "text/html" },
      });
    }

    const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const callbackUrl = `${supabaseUrl}/functions/v1/gmail-oauth-callback`;

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("Token exchange failed:", tokenData);
      return new Response(buildRedirectHtml(state.redirectUri, false, "Token exchange failed"), {
        status: 200, headers: { "Content-Type": "text/html" },
      });
    }

    // Get user's Gmail email
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();
    const gmailEmail = profile.email || "unknown";

    // Calculate expiry
    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();

    // Store in DB using service role
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: dbError } = await supabase
      .from("gmail_connections")
      .upsert({
        user_id: state.userId,
        email: gmailEmail,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: expiresAt,
      }, { onConflict: "user_id" });

    if (dbError) {
      console.error("DB error storing gmail connection:", dbError);
      return new Response(buildRedirectHtml(state.redirectUri, false, "Failed to save connection"), {
        status: 200, headers: { "Content-Type": "text/html" },
      });
    }

    return new Response(buildRedirectHtml(state.redirectUri, true, "Gmail connected successfully!"), {
      status: 200, headers: { "Content-Type": "text/html" },
    });
  } catch (e) {
    console.error("gmail-oauth-callback error:", e);
    return new Response(`<html><body><p>Error: ${e instanceof Error ? e.message : "Unknown"}</p></body></html>`, {
      status: 500, headers: { "Content-Type": "text/html" },
    });
  }
});

function buildRedirectHtml(redirectUri: string, success: boolean, message: string): string {
  const targetUrl = redirectUri || "/";
  const param = success ? "gmail_connected=true" : "gmail_error=" + encodeURIComponent(message);
  const finalUrl = targetUrl.includes("?") ? `${targetUrl}&${param}` : `${targetUrl}?${param}`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Gmail Connection</title></head>
<body>
<p>${message}</p>
<p>Redirecting...</p>
<script>
  window.location.href = "${finalUrl}";
</script>
</body>
</html>`;
}
