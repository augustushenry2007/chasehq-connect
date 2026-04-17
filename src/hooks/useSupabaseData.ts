import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/context/AppContext";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { INVOICES as MOCK_INVOICES, type Invoice as MockInvoice } from "@/lib/mockData";
import { toast } from "sonner";

export type DbInvoice = Tables<"invoices">;
export type DbFollowup = Tables<"followups">;

const DEMO_EMAIL = "demo@chasehq.app";

function dbToFrontend(db: DbInvoice): MockInvoice {
  return {
    id: db.invoice_number,
    client: db.client,
    clientEmail: db.client_email,
    description: db.description,
    amount: Number(db.amount),
    dueDate: new Date(db.due_date).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }),
    dueDateISO: db.due_date,
    status: db.status as MockInvoice["status"],
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
  const [invoices, setInvoices] = useState<MockInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeded, setSeeded] = useState(false);

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
    } else if (data && data.length > 0) {
      setInvoices(data.map(dbToFrontend));
    } else {
      // Only seed mock data for the demo account; real users start with an empty workspace
      if (user.email === DEMO_EMAIL && !seeded) {
        setSeeded(true);
        await seedInvoicesForUser(user.id);
        const { data: seededData } = await supabase
          .from("invoices")
          .select("*")
          .order("created_at", { ascending: false });
        setInvoices(seededData ? seededData.map(dbToFrontend) : []);
      } else {
        setInvoices([]);
      }
    }
    setLoading(false);
  }, [user, authReady, seeded]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  return { invoices, loading, refetch: fetchInvoices };
}

async function seedInvoicesForUser(userId: string) {
  const inserts: TablesInsert<"invoices">[] = MOCK_INVOICES.map((inv) => ({
    user_id: userId,
    invoice_number: inv.id,
    client: inv.client,
    client_email: inv.clientEmail,
    description: inv.description,
    amount: inv.amount,
    due_date: inv.dueDateISO,
    status: inv.status as any,
    days_past_due: inv.daysPastDue,
    sent_from: inv.sentFrom,
    payment_details: inv.paymentDetails,
    client_reply_snippet: inv.clientReply?.snippet || null,
    client_reply_received_at: inv.clientReply ? new Date().toISOString() : null,
    client_reply_sender_email: inv.clientReply?.senderEmail || null,
  }));

  const { error } = await supabase.from("invoices").insert(inserts);
  if (error) {
    console.error("Error seeding invoices:", error);
  }
}

export async function createInvoice(userId: string, data: {
  client: string;
  clientEmail: string;
  description: string;
  amount: number;
  dueDate: string;
}) {
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
    sent_from: "jamie@studio.co",
    payment_details: "Bank transfer · Account: 12345678 · Sort code: 12-34-56",
  }).select().single();

  if (error) {
    toast.error("Failed to create invoice: " + error.message);
    return null;
  }

  toast.success(`Invoice ${invoiceNumber} created!`);
  return invoice;
}

export async function generateFollowup(invoice: MockInvoice, tone: string): Promise<{ subject: string; message: string } | null> {
  try {
    const { data, error } = await supabase.functions.invoke("generate-followup", {
      body: { invoice, tone },
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
    // Note: Gmail OAuth token would come from a connected Gmail account
    // For now, we show a helpful message about connecting Gmail
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
