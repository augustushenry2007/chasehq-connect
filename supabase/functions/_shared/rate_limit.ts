import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Per-(subject, function) sliding window of 60 seconds.
// "subject" is a freeform identifier — pass a user uuid for authenticated
// endpoints, or `"ip:" + clientIp` for anonymous (verify_jwt = false) ones.
export async function checkRateLimit(
  supabase: SupabaseClient,
  subject: string,
  fn: string,
  maxPerMinute: number,
): Promise<{ allowed: boolean; retryAfter: number; count: number }> {
  const window = new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString();

  const { data, error } = await supabase.rpc("increment_rate_limit", {
    p_subject: subject,
    p_function_name: fn,
    p_window_start: window,
  });

  if (error) {
    // Fail open if the rate-limit infra itself is broken — better to serve a
    // request than to brick paid endpoints. Log loudly so it gets noticed.
    console.error("[rate_limit] RPC failed; failing open:", error);
    return { allowed: true, retryAfter: 0, count: 0 };
  }

  const count = typeof data === "number" ? data : (data?.count ?? 0);
  return { allowed: count <= maxPerMinute, retryAfter: 60, count };
}

// Best-effort client-IP extraction from edge function request headers.
// Cloudflare/Vercel/Supabase all forward the original IP via x-forwarded-for.
// Spoofable if the attacker controls intermediate proxies — defense in depth,
// not a hard gate.
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export function rateLimitedResponse(headers: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ error: "Rate limit exceeded. Try again in a minute." }),
    {
      status: 429,
      headers: { ...headers, "Content-Type": "application/json", "Retry-After": "60" },
    },
  );
}
