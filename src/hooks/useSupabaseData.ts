import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/context/AppContext";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import type { Invoice as FrontendInvoice } from "@/lib/data";
import { cancelForInvoice } from "@/lib/localNotifications";
import { analytics } from "@/integrations/analytics";

export type DbInvoice = Tables<"invoices">;
export type DbFollowup = Tables<"followups">;

export function useInvoices() {
  const { invoices, invoicesLoading, invoicesError, refetchInvoices } = useApp();
  return { invoices, loading: invoicesLoading, error: invoicesError, refetch: refetchInvoices };
}

export async function createInvoice(userId: string, data: {
  client: string;
  clientEmail: string;
  description: string;
  amount: number;
  dueDate: string;
  invoiceNumber?: string;
}, senderEmail = "", opts: { onDuplicate?: "error" | "returnExisting" } = {}): Promise<{ invoice: DbInvoice | null; error: string | null }> {
  // "error" (default): a clashing invoice_number is the user's mistake — toast + bail.
  // "returnExisting": the caller is the guest-draft flush, which can legitimately
  //   re-run after an interrupted first attempt that already inserted the row
  //   server-side — return that row silently and let the caller proceed (no scary
  //   "Invoice ID already used" toast for an invoice that, in fact, exists).
  const onDuplicate = opts.onDuplicate ?? "error";
  const silent = onDuplicate === "returnExisting";
  let invoiceNumber: string;

  if (data.invoiceNumber && data.invoiceNumber.trim()) {
    invoiceNumber = data.invoiceNumber.trim();
    // Reject duplicates per-user so the AI follow-ups + detail screen reference a unique ID.
    const { data: existing } = await supabase
      .from("invoices")
      .select("*")
      .eq("user_id", userId)
      .eq("invoice_number", invoiceNumber)
      .limit(1);
    if (existing && existing.length > 0) {
      if (onDuplicate === "returnExisting") {
        return { invoice: existing[0] as DbInvoice, error: null };
      }
      toast.error(`Invoice ID "${invoiceNumber}" is already used. Try a different one.`);
      return { invoice: null, error: "duplicate_invoice_number" };
    }
  } else {
    // Auto-generate: scan existing INV-NNN numbers and use MAX+1 so deletions
    // never cause a collision. Retry up to 5 times on the rare concurrent-create race.
    const { data: existing } = await supabase
      .from("invoices")
      .select("invoice_number")
      .eq("user_id", userId)
      .like("invoice_number", "INV-%");
    const maxN = (existing ?? []).reduce((m, r) => {
      const n = parseInt(r.invoice_number.slice(4), 10);
      return Number.isFinite(n) && n > m ? n : m;
    }, 0);
    let baseNum = maxN + 1;
    let attempts = 0;
    while (attempts < 5) {
      invoiceNumber = `INV-${String(baseNum).padStart(3, "0")}`;
      const { data: clash } = await supabase
        .from("invoices").select("id")
        .eq("user_id", userId).eq("invoice_number", invoiceNumber).limit(1);
      if (!clash || clash.length === 0) break;
      baseNum += 1;
      attempts += 1;
    }
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
    if (!silent) toast.error("We couldn't save that invoice. Try once more.");
    return { invoice: null, error: error.message };
  }

  if (!silent) toast.success(`Invoice ${invoiceNumber} is in — we'll handle the follow-ups.`);
  return { invoice, error: null };
}

export async function markInvoicePaid(
  invoiceNumber: string,
  paid: boolean,
  restoreStatus: string = "Upcoming"
): Promise<boolean> {
  const newStatus = paid ? "Paid" : restoreStatus;
  const { error } = await supabase
    .from("invoices")
    .update({ status: newStatus })
    .eq("invoice_number", invoiceNumber);
  return !error;
}

export async function deleteInvoice(invoiceId: string): Promise<boolean> {
  // Child rows are cleaned up by the DB on this delete: followups.invoice_id is
  // ON DELETE CASCADE, and the trg_invoice_cancel_notifications trigger cancels
  // pending notifications and removes followup_schedules. No manual cascade here.
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

// Streaming variant: pipes the edge function's SSE stream into UI callbacks
// so subject + message render progressively. Caller owns toast/UX decisions —
// this function never touches `toast` directly so screens can branch on the
// failure reason.
export type FollowupStreamHandlers = {
  onSubject: (subject: string) => void;
  onMessageDelta: (delta: string) => void;
  onDone: () => void;
  onError: (reason: "rate_limited" | "error", message?: string) => void;
};

export async function generateFollowupStream(
  invoice: FrontendInvoice,
  tone: string,
  previousMessage: string | undefined,
  senderDisplayName: string | undefined,
  userProfile: import("@/lib/userProfile/types").UserProfile | undefined,
  handlers: FollowupStreamHandlers,
): Promise<void> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

  // Same 25s budget as the prior non-streaming variant. Streaming makes the
  // wait feel shorter because text starts appearing well before this fires.
  const ctrl = new AbortController();
  const watchdog = setTimeout(() => ctrl.abort(), 25_000);

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/generate-followup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${anonKey}`,
        "Accept": "text/event-stream",
      },
      body: JSON.stringify({ invoice, tone, previousMessage, senderDisplayName, userProfile, promptVersion: 2 }),
      signal: ctrl.signal,
    });

    const ct = res.headers.get("content-type") ?? "";
    // Pre-stream errors (rate-limit, quota, upstream 4xx/5xx, payload too large)
    // come back as application/json with the existing error shape.
    if (!ct.startsWith("text/event-stream")) {
      const body = await res.json().catch(() => null) as { error?: string } | null;
      const errMsg = body?.error ?? "";
      const lower = errMsg.toLowerCase();
      if (res.status === 429 || lower.includes("rate limit") || lower.includes("daily quota")) {
        handlers.onError("rate_limited", errMsg);
      } else {
        handlers.onError("error", errMsg);
      }
      return;
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n\n")) !== -1) {
        const block = buf.slice(0, nl);
        buf = buf.slice(nl + 2);
        let event = "message";
        let data = "";
        for (const line of block.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) data = line.slice(5).trim();
        }
        if (!data) continue;
        let parsed: { subject?: string; delta?: string; error?: string };
        try {
          parsed = JSON.parse(data);
        } catch {
          continue;
        }
        if (event === "subject" && typeof parsed.subject === "string") {
          handlers.onSubject(parsed.subject);
        } else if (event === "message_delta" && typeof parsed.delta === "string") {
          handlers.onMessageDelta(parsed.delta);
        } else if (event === "done") {
          handlers.onDone();
          return;
        } else if (event === "error") {
          handlers.onError("error", typeof parsed.error === "string" ? parsed.error : undefined);
          return;
        }
      }
    }
    // Stream closed without an explicit `done` event — treat as success.
    handlers.onDone();
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    analytics.error("generate_followup_failed", e instanceof Error ? e.message : String(e), {
      aborted,
      invoiceId: invoice.id,
      tone,
    });
    if (aborted) {
      handlers.onError("error", "That draft is taking longer than usual. Try again.");
    } else {
      handlers.onError("error", "We couldn't put together a draft this time. Try again.");
    }
  } finally {
    clearTimeout(watchdog);
  }
}

export type SendResult =
  | { ok: true }
  | { ok: false; reason: "subscription_required" | "rate_limited" | "error"; message?: string };

export async function sendFollowupEmail(
  to: string,
  subject: string,
  message: string,
  invoiceId?: string,
  tone?: string,
  isAiGenerated?: boolean,
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
        body: JSON.stringify({ to, subject, message, invoiceId, tone, isAiGenerated }),
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
      return { ok: false, reason: "error", message: data.message || data.error };
    }

    return { ok: true };
  } catch (e) {
    const timedOut = e instanceof Error && e.message === "timeout";
    analytics.error("send_email_failed", e instanceof Error ? e.message : String(e), {
      timedOut,
      invoiceId,
      tone,
    });
    if (timedOut) {
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

