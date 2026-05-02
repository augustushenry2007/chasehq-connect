// Origin allowlist for browser-initiated calls. Server-to-server callers
// (Apple notifications, Supabase cron) never send a browser Origin header,
// so the allowlist applies only to fetch from a real client.
const ALLOWED_ORIGINS = new Set([
  "capacitor://localhost",   // iOS WKWebView (production build)
  "https://localhost",       // iOS WKWebView (live-reload dev)
  "http://localhost:8080",   // web dev (legacy auth path; landing has no API calls)
  "http://localhost:5173",   // vite default dev port (just in case)
]);

const ALLOWED_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-user-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

export function buildCors(origin: string | null): Record<string, string> {
  // If the request had no Origin (server-to-server), echo "*" so we don't
  // accidentally block a webhook. Browsers always send Origin, so any browser
  // request from outside the allowlist gets "null" — which fetch will reject.
  const allow = origin == null ? "*" : ALLOWED_ORIGINS.has(origin) ? origin : "null";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

// Convenience helper for the OPTIONS preflight reply.
export function preflight(req: Request): Response {
  return new Response(null, { headers: buildCors(req.headers.get("origin")) });
}
