import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      return redirect("", false, "Google authorization was denied");
    }

    if (!code || !stateParam) {
      return redirect("", false, "Missing authorization code");
    }

    let state: { userId: string; redirectUri: string };
    try {
      state = JSON.parse(atob(stateParam));
    } catch {
      return redirect("", false, "Invalid state parameter");
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
      return redirect(state.redirectUri, false, "Token exchange failed");
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
      return redirect(state.redirectUri, false, "Failed to save connection");
    }

    // Mark profile sender_type as gmail (overwrite 'none', preserve explicit 'smtp' choice)
    await supabase
      .from("profiles")
      .update({ sender_type: "gmail" })
      .eq("user_id", state.userId)
      .in("sender_type", ["none", "gmail"]);

    return redirect(state.redirectUri, true);
  } catch (e) {
    console.error("gmail-oauth-callback error:", e);
    return new Response(`Error: ${e instanceof Error ? e.message : "Unknown"}`, { status: 500 });
  }
});

function redirect(redirectUri: string, success: boolean, errorMsg?: string): Response {
  const base = redirectUri || "/";
  const param = success ? "gmail_connected=true" : "gmail_error=" + encodeURIComponent(errorMsg || "Unknown error");
  const finalUrl = base.includes("?") ? `${base}&${param}` : `${base}?${param}`;
  return new Response(null, { status: 302, headers: { Location: finalUrl } });
}
