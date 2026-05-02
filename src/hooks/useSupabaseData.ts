import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/context/AppContext";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import type { Invoice as FrontendInvoice } from "@/lib/data";
import { cancelForInvoice } from "@/lib/localNotifications";

export type DbInvoice = Tables<"invoices">;
export type DbFollowup = Tables<"followups">;

export function useInvoices() {
  const { invoices, invoicesLoading, refetchInvoices } = useApp();
  return { invoices, loading: invoicesLoading, refetch: refetchInvoices };
}

export async function createInvoice(userId: string, data: {
  client: string;
  clientEmail: string;
  description: string;
  amount: number;
  dueDate: string;
  invoiceNumber?: string;
}, senderEmail = ""): Promise<{ invoice: DbInvoice | null; error: string | null }> {
  let invoiceNumber: string;

  if (data.invoiceNumber && data.invoiceNumber.trim()) {
    invoiceNumber = data.invoiceNumber.trim();
    // Reject duplicates per-user so the AI follow-ups + detail screen reference a unique ID.
    const { data: existing } = await supabase
      .from("invoices")
      .select("id")
      .eq("user_id", userId)
      .eq("invoice_number", invoiceNumber)
      .limit(1);
    if (existing && existing.length > 0) {
      toast.error(`Invoice ID "${invoiceNumber}" is already used. Try a different one.`);
      return { invoice: null, error: "duplicate_invoice_number" };
    }
  } else {
    // Auto-generate scoped to this user (RLS-safe).
    const { count, error: countError } = await supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    const baseNum = countError ? Math.floor(Date.now() / 1000) % 100000 : (count || 0) + 1;
    invoiceNumber = `INV-${String(baseNum).padStart(3, "0")}`;
  }

  const { data: invoice, error } = await supabase.from("invoices").insert({
    user_id: userId,
    invoice_number: invoiceNumber,
    client: data.client,
    client_email: data.clientEmail,
    description: data.description,
    amount: data.amount,
    due_date: data.dueDate,
    status: "Upcoming",
    days_past_due: 0,
    sent_from: senderEmail,
    payment_details: "",
  }).select().single();

  if (error) {
    toast.error("We couldn't save that invoice. Try once more.");
    return { invoice: null, error: error.message };
  }

  toast.success(`Invoice ${invoiceNumber} is in — we'll handle the follow-ups.`);
  return { invoice, error: null };
}

export async function markInvoicePaid(
  invoiceNumber: string,
  paid: boolean,
  restoreStatus: string = "Upcoming"
): Promise<boolean> {
  const newStatus = paid ? "Paid" : restoreStatus;
  const { data: inv, error } = await supabase
    .from("invoices")
    .update({ status: newStatus, paid_at: paid ? new Date().toISOString() : null })
    .eq("invoice_number", invoiceNumber)
    .select("id")
    .single();
  if (error || !inv) return false;
  if (paid) {
    await supabase
      .from("notifications")
      .update({ status: "canceled" })
      .eq("invoice_id", inv.id)
      .eq("status", "pending");
  }
  return true;
}

export async function deleteInvoice(invoiceId: string): Promise<boolean> {
  // Best-effort cleanup of related rows (no FK cascade in schema)
  await supabase.from("followups").delete().eq("invoice_id", invoiceId);
  await supabase.from("notifications").delete().eq("invoice_id", invoiceId);
  await supabase.from("followup_schedules").delete().eq("invoice_id", invoiceId);
  const { error } = await supabase.from("invoices").delete().eq("id", invoiceId);
  if (error) {
    toast.error("We couldn't remove that invoice. Give it another try.");
    return false;
  }
  await cancelForInvoice(invoiceId);
  toast.success("Removed.");
  return true;
}

// Wraps a promise with a timeout. Resolves to the inner value or rejects with `timeout`.
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export async function generateFollowup(invoice: FrontendInvoice, tone: string, previousMessage?: string, senderDisplayName?: string): Promise<{ subject: string; message: string } | null> {
  try {
    // Tells the AI whether the user has already sent prior follow-ups on this
    // invoice. Critical for Final Notice on back-dated invoices: with 0 priors,
    // the prompt avoids the "as I mentioned previously" framing.
    const { count } = await supabase
      .from("followups")
      .select("id", { count: "exact", head: true })
      .eq("invoice_id", invoice.dbId);
    const priorFollowupCount = count ?? 0;

    const { data, error } = await withTimeout(
      supabase.functions.invoke("generate-followup", {
        body: { invoice, tone, previousMessage, senderDisplayName, priorFollowupCount },
      }),
      25_000,
    );

    if (error) {
      toast.error("Your draft didn't come through. Try once more.");
      return null;
    }

    if (data.error) {
      toast.error(data.error);
      return null;
    }

    return data;
  } catch (e) {
    if (e instanceof Error && e.message === "timeout") {
      toast.error("That draft is taking longer than usual. Try again and we'll have one ready.");
    } else {
      toast.error("We couldn't put together a draft this time. Try again.");
    }
    return null;
  }
}

export type SendResult =
  | { ok: true }
  | { ok: false; reason: "subscription_required" | "no_mailbox" | "rate_limited" | "error"; message?: string };

export async function sendFollowupEmail(
  to: string,
  subject: string,
  message: string,
  invoiceId?: string,
): Promise<SendResult> {
  try {
    // Supabase's platform gateway rejects ES256 JWTs before the function runs.
    // Bypass: send the anon key (HS256) in Authorization so the gateway is satisfied,
    // and carry the real user JWT in X-User-Token for our function's JWKS verifier.
    const { data: { session } } = await supabase.auth.getSession();
    const userToken = session?.access_token ?? "";
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

    const res = await withTimeout(
      fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${anonKey}`,
          "X-User-Token": userToken,
        },
        body: JSON.stringify({ to, subject, message, invoiceId }),
      }),
      15_000,
    );

    const data = await res.json().catch(() => null);
    if (!res.ok && !data) {
      return { ok: false, reason: "error", message: "Send failed" };
    }

    if (data?.error) {
      if (data.error === "subscription_required") {
        return { ok: false, reason: "subscription_required", message: data.message };
      }
      if (data.error === "rate_limited") {
        return { ok: false, reason: "rate_limited", message: data.message };
      }
      if (data.error === "no_mailbox" || /Gmail.*not connected|No sending mailbox/i.test(data.error)) {
        return { ok: false, reason: "no_mailbox", message: data.message || data.error };
      }
      return { ok: false, reason: "error", message: data.error };
    }

    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "timeout") {
      return { ok: false, reason: "error", message: "That took too long to send. Your draft is safe — give it another try." };
    }
    return { ok: false, reason: "error", message: "We couldn't send this one. Your draft is safe — give it another try." };
  }
}

export async function validateAppleReceipt(
  receipt: string,
  productId: string,
  mock: boolean,
  restore = false,
  clientEntitlement?: { isTrialing?: boolean; expiresAt?: string | null },
): Promise<{ ok: boolean; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  const userToken = session?.access_token ?? "";
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

  const res = await fetch(`${supabaseUrl}/functions/v1/validate-apple-receipt`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${anonKey}`,
      "X-User-Token": userToken,
    },
    body: JSON.stringify({ receipt, productId, mock, restore, ...(clientEntitlement ? { clientEntitlement } : {}) }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    return { ok: false, error: data?.error ?? "Could not activate subscription" };
  }
  return { ok: true };
}

export async function startTrial(): Promise<{ ok: boolean; already?: boolean; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  const userToken = session?.access_token ?? "";
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

  const res = await fetch(`${supabaseUrl}/functions/v1/start-trial`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${anonKey}`,
      "X-User-Token": userToken,
    },
    body: JSON.stringify({}),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    return { ok: false, error: data?.error ?? "Could not start trial" };
  }
  return { ok: true, already: data.already };
}

// Persist a follow-up in the timeline after a successful send.
export async function recordFollowup(
  userId: string,
  invoiceId: string,
  payload: { subject: string; message: string; tone: string; isAiGenerated: boolean },
) {
  const { error } = await supabase.from("followups").insert({
    user_id: userId,
    invoice_id: invoiceId,
    subject: payload.subject,
    message: payload.message,
    tone: payload.tone,
    is_ai_generated: payload.isAiGenerated,
    sent_at: new Date().toISOString(),
  });
  if (error) {
    console.error("recordFollowup error:", error);
  }
}
