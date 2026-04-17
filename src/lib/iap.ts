import { Capacitor } from "@capacitor/core";

export const PRODUCT_ID = "chasehq_pro_monthly";

export type PurchaseResult =
  | { ok: true; receipt: string; productId: string; mock?: boolean }
  | { ok: false; error: string; canceled?: boolean };

/**
 * Abstraction over Apple StoreKit. On iOS native this calls the
 * @capgo/capacitor-purchases plugin (added later via `npm i` + `npx cap sync ios`).
 * On the web/Lovable preview this returns a mock receipt so the trial→purchase
 * flow stays testable end-to-end.
 */
export async function purchaseSubscription(): Promise<PurchaseResult> {
  const isNative = Capacitor.isNativePlatform();
  if (!isNative) {
    // Mock purchase for web preview — backend treats this as a dev receipt.
    await new Promise((r) => setTimeout(r, 600));
    return { ok: true, receipt: `MOCK_RECEIPT_${Date.now()}`, productId: PRODUCT_ID, mock: true };
  }
  try {
    // Lazy-load so web build doesn't try to resolve the plugin.
    // @ts-ignore — plugin installed in iOS native build only
    const mod = await import("@capgo/capacitor-purchases");
    const Purchases = (mod as any).Purchases ?? (mod as any).default;
    const result = await Purchases.purchaseProduct({ productIdentifier: PRODUCT_ID });
    const receipt = result?.transaction?.receipt || result?.receipt || "";
    if (!receipt) return { ok: false, error: "No receipt returned from StoreKit" };
    return { ok: true, receipt, productId: PRODUCT_ID };
  } catch (e: any) {
    if (e?.code === "PURCHASE_CANCELLED" || /cancel/i.test(e?.message || "")) {
      return { ok: false, error: "Purchase canceled", canceled: true };
    }
    return { ok: false, error: e?.message || "Purchase failed" };
  }
}

export async function restorePurchases(): Promise<PurchaseResult> {
  const isNative = Capacitor.isNativePlatform();
  if (!isNative) {
    await new Promise((r) => setTimeout(r, 400));
    return { ok: true, receipt: `MOCK_RESTORE_${Date.now()}`, productId: PRODUCT_ID, mock: true };
  }
  try {
    // @ts-ignore
    const mod = await import("@capgo/capacitor-purchases");
    const Purchases = (mod as any).Purchases ?? (mod as any).default;
    const result = await Purchases.restorePurchases();
    const receipt = result?.transactions?.[0]?.receipt || result?.receipt || "";
    if (!receipt) return { ok: false, error: "No prior purchases to restore" };
    return { ok: true, receipt, productId: PRODUCT_ID };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Restore failed" };
  }
}

export function openManageSubscriptions() {
  // Apple's deep link to the user's subscription management screen.
  if (Capacitor.isNativePlatform()) {
    window.location.href = "itms-apps://apps.apple.com/account/subscriptions";
  } else {
    window.open("https://apps.apple.com/account/subscriptions", "_blank");
  }
}
