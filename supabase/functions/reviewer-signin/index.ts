// App Store Connect reviewer bypass. Apple's reviewer enters
// `appreview@chasehq.app` + OTP `123456` on the sign-in screen; the client
// calls this function, which trades the fixed code for a magic-link
// token_hash so the reviewer lands in a real session without us needing to
// deliver an actual email to a mailbox they can't access.
//
// Every call also re-seeds the reviewer account idempotently:
//   - profiles.onboarding_completed = true
//   - subscriptions = trialing with far-future end date (2030-01-01)
//   - 5 fixture invoices when none exist
// This guarantees the trial is always active and the dashboard always shows
// data, regardless of state wipes between rehearsal runs.
//
// Safe by design: the bypass works for ONE pre-created account only. The
// reviewer user holds no customer data, and delete-account refuses to delete
// it (so a curious reviewer can't burn the seed).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

import { buildCors } from "../_shared/cors.ts";
import { logError } from "../_shared/log.ts";
import {
  checkDailyQuota,
  checkRateLimit,
  getClientIp,
  quotaExceededResponse,
  rateLimitedResponse,
} from "../_shared/rate_limit.ts";

const REVIEWER_EMAIL = "appreview@chasehq.app";
const REVIEWER_CODE = "123456";
const TRIAL_ENDS_AT = "2030-01-01T00:00:00Z";

serve(async (req) => {
  const cors = buildCors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Rate-limit BEFORE credential check so an attacker can't iterate codes.
    // verify_jwt=false on this endpoint and the response body hands out a usable
    // access_token, so unchecked traffic == free session minting from anywhere.
    const ip = getClientIp(req);
    const rl = await checkRateLimit(admin, `ip:${ip}`, "reviewer-signin", 5);
    if (!rl.allowed) return rateLimitedResponse(cors);

    // Global cap: the reviewer account is one human. 100/day across all IPs is
    // ~4/hr — more than enough for App Review rehearsal, hard ceiling for abuse.
    const dq = await checkDailyQuota(admin, "global", "reviewer-signin", 100);
    if (!dq.allowed) return quotaExceededResponse(cors);

    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();
    const code = String(body?.code ?? "").trim();

    if (email !== REVIEWER_EMAIL || code !== REVIEWER_CODE) {
      return json({ error: "Invalid credentials" }, 401);
    }

    // generateLink returns { properties: { hashed_token }, user: { id } } in one call.
    let link = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: REVIEWER_EMAIL,
    });

    // First run (or someone deleted the auth.users row): create user, then retry.
    if (link.error || !link.data?.properties?.hashed_token) {
      const { error: createError } = await admin.auth.admin.createUser({
        email: REVIEWER_EMAIL,
        email_confirm: true,
      });
      if (createError && !/already|exists|registered/i.test(createError.message)) {
        logError("reviewer-signin: createUser failed:", createError.message);
        return json({ error: "Setup failed" }, 500);
      }
      link = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: REVIEWER_EMAIL,
      });
      if (link.error || !link.data?.properties?.hashed_token) {
        logError("reviewer-signin: generateLink failed after createUser:", link.error?.message);
        return json({ error: "Setup failed" }, 500);
      }
    }

    const userId = link.data.user?.id;
    if (!userId) {
      logError("reviewer-signin: generateLink returned no user id");
      return json({ error: "Setup failed" }, 500);
    }

    // Always re-seed (idempotent). Blocks so the client doesn't race the seed when
    // AppContext fires profile/subscription/invoice fetches after setSession fires SIGNED_IN.
    await reseedReviewer(admin, userId);

    // Complete sign-in server-side: verify the token here and return the full session.
    // The client calls setSession() — no client-side verifyOtp needed, eliminating the
    // race where a second generateLink call could overwrite the token before the client verifies.
    const verifyResp = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/auth/v1/verify`,
      {
        method: "POST",
        headers: {
          "apikey": Deno.env.get("SUPABASE_ANON_KEY")!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token_hash: link.data.properties.hashed_token,
          type: "magiclink",
        }),
      },
    );
    if (!verifyResp.ok) {
      logError("reviewer-signin: server-side verify failed:", await verifyResp.text());
      return json({ error: "Sign-in failed" }, 500);
    }
    const session = await verifyResp.json();
    return json({ access_token: session.access_token, refresh_token: session.refresh_token });
  } catch (e) {
    logError("reviewer-signin error:", e);
    return json({ error: "Internal error" }, 500);
  }
});

async function reseedReviewer(admin: SupabaseClient, uid: string) {
  await Promise.all([
    setOnboardingComplete(admin, uid),
    activateTrial(admin, uid),
    seedInvoicesIfEmpty(admin, uid),
  ]);
}

async function setOnboardingComplete(admin: SupabaseClient, uid: string) {
  // handle_new_user trigger created the row with onboarding_completed=false. Flip it.
  // No-op when already true.
  const { error } = await admin
    .from("profiles")
    .update({ onboarding_completed: true })
    .eq("user_id", uid);
  if (error) logError("reviewer-signin: profile update failed:", error.message);
}

async function activateTrial(admin: SupabaseClient, uid: string) {
  const nowIso = new Date().toISOString();
  // UPDATE first (matches start-trial). No status filter — force trialing
  // regardless of prior state, so a rehearsal that flipped status='canceled' or
  // similar gets restored on the next sign-in.
  const { data: updated, error: updateError } = await admin
    .from("subscriptions")
    .update({
      status: "trialing",
      plan: "chasehq_pro_monthly",
      trial_ends_at: TRIAL_ENDS_AT,
      last_event_at: nowIso,
    })
    .eq("user_id", uid)
    .select("user_id")
    .maybeSingle();
  if (updateError) logError("reviewer-signin: subscription update failed:", updateError.message);
  if (updated) return;

  const { error: insertError } = await admin.from("subscriptions").insert({
    user_id: uid,
    status: "trialing",
    plan: "chasehq_pro_monthly",
    trial_ends_at: TRIAL_ENDS_AT,
    last_event_at: nowIso,
  });
  // 23505 = unique violation; a concurrent call already inserted. Treat as success.
  if (insertError && insertError.code !== "23505") {
    logError("reviewer-signin: subscription insert failed:", insertError.message);
  }
}

async function seedInvoicesIfEmpty(admin: SupabaseClient, uid: string) {
  // Preserve any in-session reviewer state (e.g. an invoice they marked Paid)
  // by only seeding when the table is empty for this user.
  const { count, error: countError } = await admin
    .from("invoices")
    .select("id", { head: true, count: "exact" })
    .eq("user_id", uid);
  if (countError) {
    logError("reviewer-signin: invoice count failed:", countError.message);
    return;
  }
  if ((count ?? 0) > 0) return;

  const today = new Date();
  const offset = (days: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  const { error: insertError } = await admin.from("invoices").insert([
    { user_id: uid, invoice_number: "INV-R001", client: "Foxwell Media",      client_email: "accounts@foxwellmedia.com",  description: "Brand identity refresh — Q1 retainer", amount: 3200, due_date: offset(-31), status: "Escalated", days_past_due: 31, sent_from: REVIEWER_EMAIL, payment_details: "Bank transfer — Ref: INV-R001" },
    { user_id: uid, invoice_number: "INV-R002", client: "Bright Path Co.",    client_email: "billing@brightpathco.com",   description: "Website maintenance — March",          amount: 1450, due_date: offset(-10), status: "Overdue",   days_past_due: 10, sent_from: REVIEWER_EMAIL, payment_details: "Bank transfer — Ref: INV-R002" },
    { user_id: uid, invoice_number: "INV-R003", client: "Lumen Studio",       client_email: "hello@lumenstudio.co",       description: "Logo concepts (round 2)",              amount:  850, due_date: offset(-2),  status: "Follow-up", days_past_due:  2, sent_from: REVIEWER_EMAIL, payment_details: "Bank transfer — Ref: INV-R003" },
    { user_id: uid, invoice_number: "INV-R004", client: "Northwind Advisory", client_email: "ap@northwindadvisory.com",   description: "Quarterly consulting — April",         amount: 2100, due_date: offset(5),   status: "Upcoming",  days_past_due:  0, sent_from: REVIEWER_EMAIL, payment_details: "Bank transfer — Ref: INV-R004" },
    { user_id: uid, invoice_number: "INV-R005", client: "Atlas Goods",        client_email: "finance@atlasgoods.com",     description: "Packaging design system",              amount: 1275, due_date: offset(-14), status: "Paid",      days_past_due:  0, sent_from: REVIEWER_EMAIL, payment_details: "Paid via bank transfer" },
  ]);
  // 23505 here would be the unique (user_id, invoice_number) — means a concurrent
  // call beat us. Safe to ignore.
  if (insertError && insertError.code !== "23505") {
    logError("reviewer-signin: invoice insert failed:", insertError.message);
  }
}
