// Stores a single pending guest invoice draft until the user signs up.
// Once authenticated, AppContext flushes this into Supabase and clears it.

export interface PendingInvoice {
  client: string;
  clientEmail: string;
  description: string;
  amount: number;
  dueDate: string; // ISO yyyy-MM-dd
  createdAt: string;
}

const KEY = "pending_invoice_v1";
export const GUEST_ONBOARDED_KEY = "onboarding_complete_guest";

export function savePending(draft: Omit<PendingInvoice, "createdAt">) {
  try {
    const payload: PendingInvoice = { ...draft, createdAt: new Date().toISOString() };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function readPending(): PendingInvoice | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingInvoice;
  } catch {
    return null;
  }
}

export function clearPending() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

export function markGuestOnboarded() {
  try { localStorage.setItem(GUEST_ONBOARDED_KEY, "1"); } catch { /* ignore */ }
}

export function isGuestOnboarded(): boolean {
  try { return localStorage.getItem(GUEST_ONBOARDED_KEY) === "1"; } catch { return false; }
}

export function clearGuestOnboarded() {
  try { localStorage.removeItem(GUEST_ONBOARDED_KEY); } catch { /* ignore */ }
}
