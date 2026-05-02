import { describe, expect, it } from "vitest";

const STAGING_URL = process.env.STAGING_SUPABASE_URL;

describe.skipIf(!STAGING_URL)("Gemini cost-drain resistance", () => {
  it("generate-followup rejects oversized body (H3)", async () => {
    const huge = "A".repeat(20_000);
    const res = await fetch(`${STAGING_URL}/functions/v1/generate-followup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoice: { description: huge }, tone: "Polite" }),
    });
    expect([400, 413]).toContain(res.status);
  });

  it("generate-followup rate-limits per-IP burst (H3)", async () => {
    // Fire 25 quick calls; the limiter is 20/min so the tail should 429.
    const results: number[] = [];
    for (let i = 0; i < 25; i++) {
      const res = await fetch(`${STAGING_URL}/functions/v1/generate-followup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice: { client: "x", amount: "1", invoice_number: "1", description: "x" },
          tone: "Polite",
        }),
      });
      results.push(res.status);
    }
    expect(results.some((s) => s === 429)).toBe(true);
  });
});
