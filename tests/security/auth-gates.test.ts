import { describe, expect, it, beforeAll } from "vitest";

// Asserts every protected edge function returns 401 when called without a
// JWT. Skips at runtime if STAGING_SUPABASE_URL is unset (e.g. local laptop
// without staging creds) so the test suite doesn't fail on an empty env.

const STAGING_URL = process.env.STAGING_SUPABASE_URL;
const skipMessage = "STAGING_SUPABASE_URL not set — skipping live contract tests";

const PROTECTED_FUNCTIONS = [
  "send-email",
  "smtp-send",
  "smtp-verify",
  "gmail-oauth-start",
  "delete-account",
  "validate-apple-receipt",
];

describe.skipIf(!STAGING_URL)("edge function auth gates", () => {
  beforeAll(() => {
    if (!STAGING_URL) console.warn(skipMessage);
  });

  for (const fn of PROTECTED_FUNCTIONS) {
    it(`${fn} rejects unauthenticated POST`, async () => {
      const res = await fetch(`${STAGING_URL}/functions/v1/${fn}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ probe: true }),
      });
      // 401 = our app rejection; 4xx anything else is acceptable too as long
      // as it's NOT 200 (which would mean we ran logic without auth).
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });
  }
});
