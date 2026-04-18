import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/context/AppContext";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import type { Invoice as FrontendInvoice } from "@/lib/data";

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
}, senderEmail = ""): Promise<{ invoice: DbInvoice | null; error: string | null }> {
  // Generate invoice number scoped to this user (RLS-safe).
  const { count, error: countError } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  // If the count fails (e.g. transient RLS), fall back to a timestamp-based suffix.
  const baseNum = countError ? Math.floor(Date.now() / 1000) % 100000 : (count || 0) + 1;
  const invoiceNumber = `INV-${String(baseNum).padStart(3, "0")}`;

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
    const msg = `Failed to create invoice: ${error.message}${error.code ? ` (${error.code})` : ""}`;
    toast.error(msg);
    return { invoice: null, error: msg };
  }

  toast.success(`Invoice ${invoiceNumber} created!`);
  return { invoice, error: null };
}

export async function deleteInvoice(invoiceId: string): Promise<boolean> {
  // Best-effort cleanup of related followups (no FK cascade in schema)
  await supabase.from("followups").delete().eq("invoice_id", invoiceId);
  const { error } = await supabase.from("invoices").delete().eq("id", invoiceId);
  if (error) {
    toast.error("Failed to delete invoice: " + error.message);
    return false;
  }
  toast.success("Invoice deleted");
  return true;
}

export async function generateFollowup(invoice: FrontendInvoice, tone: string, previousMessage?: string): Promise<{ subject: string; message: string } | null> {
  try {
    const { data, error } = await supabase.functions.invoke("generate-followup", {
      body: { invoice, tone, previousMessage },
    });

    if (error) {
      toast.error("AI generation failed: " + error.message);
      return null;
    }

    if (data.error) {
      toast.error(data.error);
      return null;
    }

    return data;
  } catch (e) {
    toast.error("Failed to generate follow-up");
    return null;
  }
}

export async function sendFollowupEmail(
  to: string,
  subject: string,
  message: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke("send-email", {
      body: { to, subject, message },
    });

    if (error) {
      toast.error("Send failed: " + error.message);
      return false;
    }

    if (data?.error) {
      if (data.error === "subscription_required") {
        toast.error(data.message || "Subscribe to keep sending follow-ups.");
        // Best-effort redirect to paywall
        if (typeof window !== "undefined") window.location.assign("/paywall");
        return false;
      }
      if (data.error.includes("Gmail access token") || data.error.includes("Gmail token")) {
        toast.error("Gmail not connected. Connect Gmail in Settings to send emails.");
      } else {
        toast.error(data.error);
      }
      return false;
    }

    toast.success("Follow-up sent successfully!");
    return true;
  } catch (e) {
    toast.error("Failed to send email");
    return false;
  }
}
