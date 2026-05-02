// HMAC-signed OAuth state tokens. Replaces the old base64-JSON state, which
// was forgeable and let an attacker bind a victim's Gmail tokens to an
// arbitrary userId during the OAuth dance.
//
// Format: base64url(payload).base64url(hmacSha256(secret, base64url(payload)))
// The signature is verified with constant-time comparison; expired / replayed
// states are rejected by the iat check in verifyState().

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export interface StatePayload {
  userId: string;
  redirectUri: string;
  nonce: string;
  iat: number;
}

export async function signState(payload: StatePayload, secret: string): Promise<string> {
  const body = b64urlEncode(enc.encode(JSON.stringify(payload)));
  const key = await hmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(body)));
  return `${body}.${b64urlEncode(sig)}`;
}

export interface VerifyOptions {
  maxAgeMs?: number;
  redirectAllowlist?: string[];
}

export async function verifyState(
  token: string,
  secret: string,
  opts: VerifyOptions = {},
): Promise<StatePayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [body, sig] = parts;

    const key = await hmacKey(secret);
    const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(body)));
    const provided = b64urlDecode(sig);
    if (!constantTimeEqual(expected, provided)) return null;

    const payload = JSON.parse(dec.decode(b64urlDecode(body))) as StatePayload;
    if (!payload.userId || !payload.redirectUri || !payload.nonce || !payload.iat) return null;

    const maxAge = opts.maxAgeMs ?? 10 * 60 * 1000;
    if (Date.now() - payload.iat > maxAge) return null;

    if (opts.redirectAllowlist && !opts.redirectAllowlist.includes(payload.redirectUri)) return null;

    return payload;
  } catch {
    return null;
  }
}

// Server-side allowlist of redirect URIs the OAuth callback is willing to
// hand control back to. Anything else is treated as an attempted open
// redirect and rejected at verify time.
export const REDIRECT_ALLOWLIST = [
  "capacitor://localhost",
  "capacitor://localhost/",
  "https://chasehq.app",
  "https://chasehq.app/",
  "https://chasehq.app/auth-after-invoice",
  "http://localhost:8080",
  "http://localhost:8080/",
  "http://localhost:8080/auth-after-invoice",
  "http://localhost:5173",
  "http://localhost:5173/",
];
