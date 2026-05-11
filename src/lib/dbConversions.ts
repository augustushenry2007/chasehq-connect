import type { Tables } from "@/integrations/supabase/types";
import type { Invoice as FrontendInvoice } from "@/lib/data";
import { formatDate } from "@/lib/data";

type DbInvoice = Tables<"invoices">;

export function dbToFrontend(db: DbInvoice): FrontendInvoice {
  return {
    id: db.invoice_number,
    dbId: db.id,
    client: db.client,
    clientEmail: db.client_email,
    description: db.description,
    amount: Number(db.amount),
    dueDate: formatDate(db.due_date),
    dueDateISO: db.due_date,
    createdAtISO: db.created_at,
    status: db.status as FrontendInvoice["status"],
    daysPastDue: db.days_past_due,
    sentFrom: db.sent_from,
    paymentDetails: db.payment_details,
    clientReply: db.client_reply_snippet ? {
      snippet: db.client_reply_snippet,
      receivedAt: db.client_reply_received_at ? new Date(db.client_reply_received_at).toLocaleString() : "Recently",
      channel: "email" as const,
      senderEmail: db.client_reply_sender_email || db.client_email,
    } : undefined,
  };
}
