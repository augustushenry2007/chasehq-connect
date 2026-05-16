// Gmail/Yahoo/Apple bulk-sender rules (Feb 2024) require One-Click unsubscribe
// in headers on bulk + transactional-with-marketing-tone mail. Missing this
// header is a top reason chase emails land in Promotions/Spam.
//
// URL is signed with HMAC-SHA256(recipient, SUPABASE_JWT_SECRET): the
// /unsubscribe endpoint refuses any (r, t) pair that doesn't match. Prevents a
// random scanner from suppressing arbitrary recipient addresses by guessing
// URLs. The mailto: half is also functional — a human can read
// unsubscribe@chasehq.app.

async function hmacToken(recipient: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(recipient.toLowerCase()));
  // Hex; truncate to 16 chars (64 bits) — plenty for an unsubscribe URL where
  // the worst case of a brute is "someone unsubscribes a recipient who didn't
  // ask," which is failsafe.
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

export async function buildUnsubscribeHeaders(recipient: string): Promise<{
  "List-Unsubscribe": string;
  "List-Unsubscribe-Post": string;
}> {
  const secret = Deno.env.get("SUPABASE_JWT_SECRET") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const token = secret ? await hmacToken(recipient, secret) : "";
  const r = encodeURIComponent(recipient);
  const t = encodeURIComponent(token);
  const url = `${supabaseUrl}/functions/v1/unsubscribe?r=${r}&t=${t}`;
  return {
    "List-Unsubscribe": `<${url}>, <mailto:unsubscribe@chasehq.app?subject=unsubscribe>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

export async function verifyUnsubscribeToken(recipient: string, token: string): Promise<boolean> {
  const secret = Deno.env.get("SUPABASE_JWT_SECRET") ?? "";
  if (!secret) return false;
  const expected = await hmacToken(recipient, secret);
  // Constant-time compare.
  if (expected.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}
