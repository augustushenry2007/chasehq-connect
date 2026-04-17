import { supabase } from "@/integrations/supabase/client";

export interface PendingInvoice {
  client: string;
  amount: number;
  dueDate: string; // ISO yyyy-mm-dd
  tone: "Polite" | "Friendly" | "Firm" | "Urgent";
  message: string;
  subject: string;
}

const KEY = "chasehq:pending_onboarding_invoice";

export function savePendingInvoice(p: PendingInvoice) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {}
}

export function readPendingInvoice(): PendingInvoice | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PendingInvoice) : null;
  } catch {
    return null;
  }
}

export function clearPendingInvoice() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

/**
 * Persists a pending onboarding invoice + its first follow-up to the DB
 * for the given user. Idempotent: clears localStorage on success.
 */
export async function persistPendingInvoice(userId: string): Promise<boolean> {
  const pending = readPendingInvoice();
  if (!pending) return false;

  const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
  const today = new Date();
  const due = new Date(pending.dueDate);
  const daysPastDue = Math.max(0, Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
  const status = daysPastDue > 0 ? "Overdue" : "Follow-up";

  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .insert({
      user_id: userId,
      invoice_number: invoiceNumber,
      client: pending.client,
      client_email: "",
      description: "First follow-up",
      amount: pending.amount,
      due_date: pending.dueDate,
      status: status as any,
      days_past_due: daysPastDue,
    })
    .select()
    .single();

  if (invErr || !invoice) {
    console.error("[pendingInvoice] failed to persist invoice", invErr);
    return false;
  }

  await supabase.from("followups").insert({
    user_id: userId,
    invoice_id: invoice.id,
    tone: pending.tone,
    subject: pending.subject,
    message: pending.message,
    is_ai_generated: false,
    sent_at: new Date().toISOString(),
  });

  clearPendingInvoice();
  return true;
}
