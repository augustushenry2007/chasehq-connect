// Prompt-injection sanitization + payload-size guards for AI endpoints.
// Defense in depth: rate limits cap how often Gemini can be called, but
// injection filtering caps what those calls can be steered into doing,
// and size limits cap how expensive each call can be.

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|messages?|rules?)/gi,
  /disregard\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|messages?|rules?)/gi,
  /forget\s+(everything|all|previous|prior)/gi,
  /you\s+are\s+(now\s+)?(a|an)\s+\w+\s+(assistant|model|ai|agent)/gi,
  /\bsystem\s*[:=]/gi,
  /\bassistant\s*[:=]/gi,
  /<\s*\/?\s*(system|user|assistant|tool|prompt)\s*>/gi,
  /\[\s*(system|inst|instruction|prompt)\s*\]/gi,
  /```\s*(system|prompt|instructions?)/gi,
  /reveal\s+(your|the)\s+(system\s+)?prompt/gi,
  /repeat\s+(your|the)\s+(system\s+)?(prompt|instructions?)/gi,
];

export interface SanitizeResult {
  sanitized: string;
  attempts: number;
}

export function sanitizeUserText(input: unknown, maxLen = 2000): SanitizeResult {
  const s = typeof input === "string" ? input : "";
  const truncated = s.length > maxLen ? s.slice(0, maxLen) : s;
  let attempts = 0;
  let out = truncated;
  for (const re of INJECTION_PATTERNS) {
    out = out.replace(re, () => {
      attempts++;
      return "[redacted]";
    });
  }
  return { sanitized: out, attempts };
}

// Hard caps for request body size. Reject early so a 1MB description can't
// even reach the AI provider, regardless of token cost.
export const MAX_BODY_BYTES = 16 * 1024;
export const MAX_FIELD_CHARS = 2000;
export const MAX_SHORT_FIELD_CHARS = 500;

// Read JSON body with size cap. Returns null + sets the response on overflow.
export async function readJsonWithCap<T = unknown>(
  req: Request,
  maxBytes = MAX_BODY_BYTES,
): Promise<{ ok: true; body: T } | { ok: false; status: number; error: string }> {
  const cl = req.headers.get("content-length");
  if (cl && parseInt(cl, 10) > maxBytes) {
    return { ok: false, status: 413, error: "Payload too large" };
  }
  const buf = new Uint8Array(await req.arrayBuffer());
  if (buf.byteLength > maxBytes) {
    return { ok: false, status: 413, error: "Payload too large" };
  }
  try {
    return { ok: true, body: JSON.parse(new TextDecoder().decode(buf)) as T };
  } catch {
    return { ok: false, status: 400, error: "Invalid JSON" };
  }
}
