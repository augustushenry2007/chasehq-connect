// Redacting console wrappers. Every edge function should use these instead of
// raw console.* so we never accidentally write a Bearer token, JWT, or API key
// to Supabase logs (which are visible to anyone with project dashboard access).

const PATTERNS: Array<[RegExp, string]> = [
  [/Bearer\s+[A-Za-z0-9._\-+/=]+/g, "Bearer [redacted]"],
  [/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, "[jwt-redacted]"],
  [/sk-[A-Za-z0-9_-]{16,}/g, "sk-[redacted]"],
  [/AIza[0-9A-Za-z_-]{20,}/g, "AIza[redacted]"],
  [/AKIA[0-9A-Z]{16}/g, "AKIA[redacted]"],
  [/\b(?:password|passwd|secret|token|api_key|api-key|apikey)["'\s:=]+["']?[A-Za-z0-9._\-+/=]{8,}/gi, "$1=[redacted]"],
];

function scrub(s: string): string {
  let out = s;
  for (const [re, repl] of PATTERNS) out = out.replace(re, repl);
  return out;
}

function scrubArg(a: unknown): unknown {
  if (typeof a === "string") return scrub(a);
  if (a instanceof Error) return new Error(scrub(a.message));
  if (a && typeof a === "object") {
    try {
      return JSON.parse(scrub(JSON.stringify(a)));
    } catch {
      return "[unserializable]";
    }
  }
  return a;
}

export function logError(...args: unknown[]): void {
  console.error(...args.map(scrubArg));
}

export function logWarn(...args: unknown[]): void {
  console.warn(...args.map(scrubArg));
}

export function logInfo(...args: unknown[]): void {
  console.log(...args.map(scrubArg));
}

// Truncate untrusted strings before logging — third-party error bodies can
// be large and contain echoed credentials.
export function truncate(s: string | undefined | null, n = 300): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}
