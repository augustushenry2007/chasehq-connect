// App Store Connect reviewer bypass. Apple's reviewer enters
// `appreview@chasehq.app` + OTP `123456` on the sign-in screen; the client
// calls this function, which trades the fixed code for a magic-link
// token_hash so the reviewer lands in a real session without us needing to
// deliver an actual email to a mailbox they can't access.
//
// Safe by design: the bypass works for ONE pre-created account only. The
// reviewer user holds no customer data, and delete-account refuses to delete
// it (so a curious reviewer can't burn the seed).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { buildCors } from "../_shared/cors.ts";
import { logError } from "../_shared/log.ts";

const REVIEWER_EMAIL = "appreview@chasehq.app";
const REVIEWER_CODE = "123456";

serve(async (req) => {
  const cors = buildCors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();
    const code = String(body?.code ?? "").trim();

    if (email !== REVIEWER_EMAIL || code !== REVIEWER_CODE) {
      return json({ error: "Invalid credentials" }, 401);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error: createError } = await admin.auth.admin.createUser({
      email: REVIEWER_EMAIL,
      email_confirm: true,
    });
    if (createError && !/already|exists|registered/i.test(createError.message)) {
      logError("reviewer-signin: createUser failed:", createError.message);
      return json({ error: "Setup failed" }, 500);
    }

    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: REVIEWER_EMAIL,
    });
    if (linkError || !link?.properties?.hashed_token) {
      logError("reviewer-signin: generateLink failed:", linkError?.message ?? "no token");
      return json({ error: "Setup failed" }, 500);
    }

    return json({ token_hash: link.properties.hashed_token });
  } catch (e) {
    logError("reviewer-signin error:", e);
    return json({ error: "Internal error" }, 500);
  }
});
