import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TRIAL_DAYS = 30;

serve(async (req) => {
  console.log("start-trial: invoked", req.method);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Not authenticated" }, 401);

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return json({ error: "Invalid session" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: existing } = await admin
      .from("subscriptions").select("*").eq("user_id", user.id).maybeSingle();

    // If user already has any non-'none' subscription, don't restart trial.
    if (existing && existing.status !== "none") {
      return json({
        ok: true,
        already: true,
        status: existing.status,
        trial_ends_at: existing.trial_ends_at,
      });
    }

    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 86400_000).toISOString();
    const nowIso = new Date().toISOString();

    const upsert = await admin.from("subscriptions").upsert({
      user_id: user.id,
      status: "trialing",
      plan: "chasehq_pro_monthly",
      trial_ends_at: trialEndsAt,
      last_event_at: nowIso,
    }, { onConflict: "user_id" }).select().maybeSingle();

    if (upsert.error) {
      console.error("start-trial upsert error:", upsert.error);
      return json({ error: "Could not start trial" }, 500);
    }

    await admin.from("subscription_events").insert({
      user_id: user.id,
      event_type: "trial_started",
      payload: { trial_ends_at: trialEndsAt, plan: "chasehq_pro_monthly" },
    });

    return json({ ok: true, status: "trialing", trial_ends_at: trialEndsAt });
  } catch (e) {
    console.error("start-trial error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
