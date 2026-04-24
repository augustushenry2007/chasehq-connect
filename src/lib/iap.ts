export const PRODUCT_ID = "chasehq_pro_monthly";

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
}

export async function purchaseSubscription(): Promise<PurchaseResult> {
  if (!isNativePlatform()) {
    await new Promise((r) => setTimeout(r, 600));
    return { ok: true, receipt: `MOCK_RECEIPT_${Date.now()}`, productId: PRODUCT_ID, mock: true };
  }
  try {
    const pkg = "@capgo/capacitor-purchases";
    // @ts-ignore — plugin installed in iOS native build only
    const mod = await import(/* @vite-ignore */ pkg);
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
  if (!isNativePlatform()) {
    await new Promise((r) => setTimeout(r, 400));
    return { ok: true, receipt: `MOCK_RESTORE_${Date.now()}`, productId: PRODUCT_ID, mock: true };
  }
  try {
    const pkg = "@capgo/capacitor-purchases";
    // @ts-ignore
    const mod = await import(/* @vite-ignore */ pkg);
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
  if (isNativePlatform()) {
    window.location.href = "itms-apps://apps.apple.com/account/subscriptions";
  } else {
    window.open("https://apps.apple.com/account/subscriptions", "_blank");
  }
}
