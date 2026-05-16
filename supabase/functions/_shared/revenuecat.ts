// Shared RevenueCat REST verification, used by validate-apple-receipt (the
// purchase/restore path) and send-email (the entitlement fallback when the
// local `subscriptions` row write failed after a successful purchase).
//
// SECURITY: callers MUST pass the *authenticated* Supabase user id as appUserId.
// The client calls Purchases.logIn({ appUserID: <supabase uid> }) before any
// purchase/restore, so the RC app-user-id is always the session's uid — never
// trust an id supplied by the client.
import { logError } from "./log.ts";

const RC_ENTITLEMENT_ID = "ChaseHQ Pro";

export type RevenueCatResult =
  | {
      ok: true;
      status: "trialing" | "active";
      currentPeriodEnd: string;
      trialEndsAt: string | null;
      originalTransactionId: string;
    }
  | { ok: false; error: string };

export async function verifyWithRevenueCat(appUserId: string, secretKey: string): Promise<RevenueCatResult> {
  const res = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
    { headers: { "Authorization": `Bearer ${secretKey}`, "Content-Type": "application/json" } }
  );
  if (!res.ok) {
    const bodyText = await res.text().catch(() => "<unreadable>");
    logError("[revenuecat] API error", { status: res.status, body: bodyText.slice(0, 500), appUserId });
    if (res.status === 401 || res.status === 403) {
      return { ok: false as const, error: "Subscription verification is temporarily unavailable. Please try Restore Purchases in a moment." };
    }
    return { ok: false as const, error: `RevenueCat API error (${res.status})` };
  }
  const data = await res.json();
  const entitlement = data.subscriber?.entitlements?.[RC_ENTITLEMENT_ID];
  if (!entitlement?.expires_date) {
    return { ok: false as const, error: "No active ChaseHQ Pro subscription found" };
  }
  const expiresDate = new Date(entitlement.expires_date);
  if (expiresDate < new Date()) {
    return { ok: false as const, error: "Subscription has expired" };
  }
  const sub = data.subscriber?.subscriptions?.[entitlement.product_identifier];
  const periodType = sub?.period_type ?? "normal";
  const isTrialing = periodType === "trial" || periodType === "intro";
  return {
    ok: true as const,
    status: isTrialing ? "trialing" as const : "active" as const,
    currentPeriodEnd: expiresDate.toISOString(),
    trialEndsAt: isTrialing ? expiresDate.toISOString() : null,
    originalTransactionId: sub?.original_transaction_id ?? appUserId,
  };
}
