import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/context/AppContext";
import type { Tables } from "@/integrations/supabase/types";
import type { Invoice as FrontendInvoice } from "@/lib/data";
import { toast } from "sonner";

export type DbInvoice = Tables<"invoices">;
export type DbFollowup = Tables<"followups">;

function dbToFrontend(db: DbInvoice): FrontendInvoice {
  return {
    id: db.invoice_number,
    client: db.client,
    clientEmail: db.client_email,
    description: db.description,
    amount: Number(db.amount),
    dueDate: new Date(db.due_date).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }),
    dueDateISO: db.due_date,
    status: db.status as FrontendInvoice["status"],
    daysPastDue: db.days_past_due,
    sentFrom: db.sent_from,
    paymentDetails: db.payment_details,
    clientReply: db.client_reply_snippet ? {
      snippet: db.client_reply_snippet,
      receivedAt: db.client_reply_received_at ? new Date(db.client_reply_received_at).toLocaleString() : "Recently",
      channel: "email",
      senderEmail: db.client_reply_sender_email || db.client_email,
    } : undefined,
  };
}

export function useInvoices() {
  const { user, authReady } = useApp();
  const [invoices, setInvoices] = useState<FrontendInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInvoices = useCallback(async () => {
    if (!authReady) return;
    if (!user) {
      setInvoices([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching invoices:", error);
      setInvoices([]);
    } else {
      setInvoices(data ? data.map(dbToFrontend) : []);
    }
    setLoading(false);
  }, [user, authReady]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  return { invoices, loading, refetch: fetchInvoices };
}

export async function createInvoice(userId: string, data: {
  client: string;
  clientEmail: string;
  description: string;
  amount: number;
  dueDate: string;
}, senderEmail = "") {
  const { count } = await supabase.from("invoices").select("*", { count: "exact", head: true });
  const num = (count || 0) + 1;
  const invoiceNumber = `INV-${String(num).padStart(3, "0")}`;

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
    toast.error("Failed to create invoice: " + error.message);
    return null;
  }

  toast.success(`Invoice ${invoiceNumber} created!`);
  return invoice;
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

    if (data.error) {
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
