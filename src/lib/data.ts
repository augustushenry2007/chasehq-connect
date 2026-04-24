export type InvoiceStatus = "Escalated" | "Overdue" | "Follow-up" | "Upcoming" | "Paid";
export type ActivityType = "payment" | "reminder" | "escalation" | "view" | "overdue" | "reply";

export interface ClientReply {
  snippet: string;
  receivedAt: string;
  channel: "email";
  senderEmail: string;
}

export interface Invoice {
  id: string;
  dbId: string;
  client: string;
  clientEmail: string;
  description: string;
  amount: number;
  dueDate: string;
  dueDateISO: string;
  status: InvoiceStatus;
  daysPastDue: number;
  sentFrom: string;
  paymentDetails: string;
  clientReply?: ClientReply;
}

export interface ActivityItem {
  id: string;
  invoiceId: string;
  client: string;
  description: string;
  timeAgo: string;
  type: ActivityType;
}

export function getStats(invoices: Invoice[]) {
  const outstanding = invoices.filter((i) => i.status !== "Paid");
  const overdue = invoices.filter((i) => i.status === "Escalated" || i.status === "Overdue");
  const paid = invoices.filter((i) => i.status === "Paid");
  const upcoming = invoices.filter((i) => i.status === "Upcoming");
  return {
    outstandingTotal: outstanding.reduce((s, i) => s + i.amount, 0),
    outstandingCount: outstanding.length,
    overdueTotal: overdue.reduce((s, i) => s + i.amount, 0),
    overdueCount: overdue.length,
    paidTotal: paid.reduce((s, i) => s + i.amount, 0),
    paidCount: paid.length,
    upcomingTotal: upcoming.reduce((s, i) => s + i.amount, 0),
    upcomingCount: upcoming.length,
  };
}

export function getInvoiceById(id: string, invoices: Invoice[]): Invoice | undefined {
  return invoices.find((i) => i.id === id);
}

export function getChaseFeed(invoices: Invoice[]) {
  return invoices.filter(
    (i) => i.status === "Escalated" || i.status === "Overdue" || i.status === "Follow-up"
  ).sort((a, b) => b.daysPastDue - a.daysPastDue);
}

export function formatUSD(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
