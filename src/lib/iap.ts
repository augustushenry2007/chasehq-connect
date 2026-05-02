import { Purchases } from "@revenuecat/purchases-capacitor";
import { supabase } from "@/integrations/supabase/client";
import { validateAppleReceipt } from "@/hooks/useSupabaseData";

export const PRODUCT_ID = "chasehq_pro_monthly";

// RevenueCat entitlement identifier — must match the key you set in the RC dashboard.
// dashboard.revenuecat.com → Your project → Entitlements
const ENTITLEMENT_ID = "ChaseHQ Pro";

// Get this from: dashboard.revenuecat.com → Your project → API keys → Apple App Store
// It looks like: appl_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export const RC_APPLE_API_KEY = "appl_PQBujDvCrrvsywIbvmgnjrKvYFp";

// Use the global injected by Capacitor native shell instead of importing the
// package at build time. This prevents the Capacitor bridge from initialising
// in a plain browser context, which floods the console with toUrl errors.
export function isNativePlatform(): boolean {
  return !!(window as any).Capacitor?.isNativePlatform?.();
}

export interface PurchaseResult {
  ok: boolean;
  receipt?: string;
  productId?: string;
  mock?: boolean;
  error?: string;
  canceled?: boolean;
  entitled?: boolean;
  isTrialing?: boolean;
  expiresAt?: string | null;
}

export interface ActiveEntitlement {
  entitled: boolean;
  isTrialing: boolean;
  expiresAt: string | null;
  originalAppUserId: string;
}

export async function getActiveEntitlement(): Promise<ActiveEntitlement | null> {
  if (!isNativePlatform() || !rcConfigured) return null;
  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    const ent = customerInfo.entitlements.active[ENTITLEMENT_ID];
    if (!ent) return null;
    return {
      entitled: true,
      isTrialing: ent.periodType === "TRIAL" || ent.periodType === "INTRO",
      expiresAt: ent.expirationDate ?? customerInfo.latestExpirationDate ?? null,
      originalAppUserId: customerInfo.originalAppUserId,
    };
  } catch {
    return null;
  }
}

export async function syncSubscriptionToSupabase(
  receipt: string,
  productId: string,
  mock: boolean,
  opts?: { onSynced?: () => void; isTrialing?: boolean; expiresAt?: string | null },
): Promise<void> {
  const { onSynced, isTrialing, expiresAt } = opts ?? {};
  const clientEntitlement = (isTrialing !== undefined || expiresAt !== undefined)
    ? { isTrialing, expiresAt }
    : undefined;
  const delays = [1000, 3000, 8000];
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, delays[attempt - 1]));
    }
    try {
      const result = await validateAppleReceipt(receipt, productId, mock, false, clientEntitlement);
      if (result.ok) {
        onSynced?.();
        return;
      }
      console.warn(`[iap] sync attempt ${attempt + 1} failed:`, result.error);
    } catch (e) {
      console.warn(`[iap] sync attempt ${attempt + 1} threw:`, e);
    }
  }
}

let rcConfigured = false;
let rcLoggedInUserId: string | null = null;

export async function configureRC(appUserId?: string): Promise<boolean> {
  if (RC_APPLE_API_KEY.startsWith("REPLACE_")) return false;
  if (!isNativePlatform()) return false;
  try {
    if (!rcConfigured) {
      await Purchases.configure({ apiKey: RC_APPLE_API_KEY, appUserID: appUserId });
      rcConfigured = true;
      rcLoggedInUserId = appUserId ?? null;
      return true;
    }
    if (appUserId && rcLoggedInUserId !== appUserId) {
      await Purchases.logIn({ appUserID: appUserId });
      rcLoggedInUserId = appUserId;
    }
    return true;
  } catch (e) {
    console.error("[iap] configureRC failed", e);
    return false;
  }
}

export async function logoutRC(): Promise<void> {
  if (!rcConfigured || !isNativePlatform()) return;
  try { await Purchases.logOut(); } catch {}
  rcLoggedInUserId = null;
}

export async function purchaseSubscription(): Promise<PurchaseResult> {
  if (!isNativePlatform()) {
    await new Promise((r) => setTimeout(r, 600));
    return { ok: true, receipt: `MOCK_RECEIPT_${Date.now()}`, productId: PRODUCT_ID, mock: true, entitled: true };
  }

  const { data: { user } } = await supabase.auth.getUser();
  const ready = await configureRC(user?.id);
  if (!ready) {
    // RC not configured yet (missing API key) — fall back to mock so the flow is testable
    await new Promise((r) => setTimeout(r, 600));
    return { ok: true, receipt: `MOCK_RECEIPT_${Date.now()}`, productId: PRODUCT_ID, mock: true, entitled: true };
  }

  try {
    const offerings = await Purchases.getOfferings();
    const pkg =
      offerings.current?.availablePackages.find(
        (p) => p.product.identifier === PRODUCT_ID
      ) ?? offerings.current?.availablePackages[0];

    if (!pkg) {
      console.error("[iap] no current offering / packages available", { offerings });
      return { ok: false, error: "Subscriptions aren't available just yet. Please try again in a few minutes." };
    }

    const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
    const ent = customerInfo.entitlements.active[ENTITLEMENT_ID];

    return {
      ok: true,
      receipt: `RC_CUSTOMER:${customerInfo.originalAppUserId}`,
      productId: PRODUCT_ID,
      entitled: !!ent,
      isTrialing: ent?.periodType === "TRIAL" || ent?.periodType === "INTRO",
      expiresAt: ent?.expirationDate ?? customerInfo.latestExpirationDate ?? null,
    };
  } catch (e: any) {
    if (e?.userCancelled === true || e?.code === "1" || /cancel/i.test(e?.message || "")) {
      return { ok: false, error: "Purchase canceled", canceled: true };
    }
    console.error("[iap] purchase failed", { code: e?.code, message: e?.message, underlying: e?.underlyingErrorMessage, raw: e });
    // RC error code 23 = CONFIGURATION_ERROR (offerings/products not set up in dashboard).
    if (e?.code === "23" || e?.code === 23 || /offerings|configured/i.test(e?.message || "")) {
      return { ok: false, error: "Subscriptions aren't available just yet. Please try again in a few minutes." };
    }
    return { ok: false, error: e?.message || "Purchase failed" };
  }
}

export async function restorePurchases(): Promise<PurchaseResult> {
  if (!isNativePlatform()) {
    await new Promise((r) => setTimeout(r, 400));
    return { ok: true, receipt: `MOCK_RESTORE_${Date.now()}`, productId: PRODUCT_ID, mock: true };
  }

  const { data: { user } } = await supabase.auth.getUser();
  const ready = await configureRC(user?.id);
  if (!ready) {
    await new Promise((r) => setTimeout(r, 400));
    return { ok: true, receipt: `MOCK_RESTORE_${Date.now()}`, productId: PRODUCT_ID, mock: true };
  }

  try {
    const { customerInfo } = await Purchases.restorePurchases();
    const ent = customerInfo.entitlements.active[ENTITLEMENT_ID];
    if (!ent) return { ok: false, error: "No active subscription found on this account." };

    return {
      ok: true,
      receipt: `RC_CUSTOMER:${customerInfo.originalAppUserId}`,
      productId: PRODUCT_ID,
      entitled: true,
      isTrialing: ent.periodType === "TRIAL" || ent.periodType === "INTRO",
      expiresAt: ent.expirationDate ?? customerInfo.latestExpirationDate ?? null,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Restore failed" };
  }
}

export function openManageSubscriptions() {
  if (isNativePlatform()) {
    window.location.href = "itms-apps://apps.apple.com/account/subscriptions";
  } else {
    window.open("https://apps.apple.com/account/subscriptions", "_blank");
  }
}
