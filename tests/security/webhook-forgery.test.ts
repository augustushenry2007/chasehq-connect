import { describe, expect, it } from "vitest";

const STAGING_URL = process.env.STAGING_SUPABASE_URL;

// These cover Critical fixes C1, H1, and parts of C2.
// Each test sends a forged or unsigned request and asserts a 4xx — never a
// 200, which would mean an attacker had succeeded.

describe.skipIf(!STAGING_URL)("webhook forgery resistance", () => {
  it("apple-notifications rejects unsigned JWS (C1)", async () => {
    // base64url("{}") = "e30"; clearly not Apple-signed.
    const res = await fetch(`${STAGING_URL}/functions/v1/apple-notifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signedPayload: "e30.e30.invalid" }),
    });
    expect([400, 401, 403]).toContain(res.status);
  });

  it("dispatch-notifications rejects without x-cron-secret (H1)", async () => {
    const res = await fetch(`${STAGING_URL}/functions/v1/dispatch-notifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(401);
  });

  it("validate-apple-receipt rejects RC_CUSTOMER + clientEntitlement attack (C2)", async () => {
    const res = await fetch(`${STAGING_URL}/functions/v1/validate-apple-receipt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.TEST_USER_A_JWT ?? ""}`,
      },
      body: JSON.stringify({
        receipt: "RC_CUSTOMER:fake",
        clientEntitlement: { isTrialing: false, expiresAt: "2099-01-01T00:00:00Z" },
        productId: "chasehq_pro_monthly",
      }),
    });
    // The clientEntitlement fallback is removed; expect 503 (RC unavailable)
    // or 4xx (auth/validation), but NEVER a 200 grant.
    expect(res.status).not.toBe(200);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("gmail-oauth-callback rejects unsigned state (C3)", async () => {
    // Old format: base64-JSON state. After Fix C3, this should fail HMAC verify.
    const oldState = btoa(JSON.stringify({ userId: "00000000-0000-0000-0000-000000000000", redirectUri: "/" }));
    const res = await fetch(
      `${STAGING_URL}/functions/v1/gmail-oauth-callback?code=abc&state=${encodeURIComponent(oldState)}`,
      { redirect: "manual" },
    );
    // Callback redirects on failure, so look for 302 to "/" with gmail_error param.
    expect([302, 400, 401]).toContain(res.status);
    if (res.status === 302) {
      const loc = res.headers.get("Location") ?? "";
      expect(loc).toMatch(/gmail_error/);
    }
  });
});
