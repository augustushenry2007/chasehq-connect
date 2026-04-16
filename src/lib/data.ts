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

export const USER = {
  name: "Jamie Doe",
  initials: "JD",
  email: "jamie@studio.co",
};

export const INVOICES: Invoice[] = [
  { id: "INV-001", client: "Apex Digital", clientEmail: "billing@apexdigital.com", description: "Brand identity & logo system", amount: 4800, dueDate: "May 10, 2024", dueDateISO: "2024-05-10", status: "Escalated", daysPastDue: 28, sentFrom: "jamie@studio.co", paymentDetails: "Bank transfer · Account: 12345678 · Sort code: 12-34-56" },
  { id: "INV-002", client: "Momentum Labs", clientEmail: "accounts@momentumlabs.io", description: "Q2 retainer – UI/UX design", amount: 3200, dueDate: "May 18, 2024", dueDateISO: "2024-05-18", status: "Overdue", daysPastDue: 20, sentFrom: "jamie@studio.co", paymentDetails: "Bank transfer · Account: 12345678 · Sort code: 12-34-56" },
  { id: "INV-003", client: "Fieldstone Co.", clientEmail: "finance@fieldstoneco.com", description: "Website redesign, 3 pages", amount: 6500, dueDate: "May 22, 2024", dueDateISO: "2024-05-22", status: "Follow-up", daysPastDue: 16, sentFrom: "jamie@studio.co", paymentDetails: "Bank transfer · Account: 12345678 · Sort code: 12-34-56", clientReply: { snippet: "Hi Jamie, thanks for the reminder. We'll process payment by end of Friday — apologies for the delay on our end.", receivedAt: "2 hours ago", channel: "email", senderEmail: "finance@fieldstoneco.com" } },
  { id: "INV-004", client: "Solaris Media", clientEmail: "ap@solarismedia.com", description: "Social media asset pack", amount: 1200, dueDate: "May 30, 2024", dueDateISO: "2024-05-30", status: "Upcoming", daysPastDue: 0, sentFrom: "jamie@studio.co", paymentDetails: "Bank transfer · Account: 12345678 · Sort code: 12-34-56" },
  { id: "INV-005", client: "Neon Atlas", clientEmail: "billing@neonatlas.co", description: "Annual brand strategy report", amount: 9500, dueDate: "Jun 5, 2024", dueDateISO: "2024-06-05", status: "Upcoming", daysPastDue: 0, sentFrom: "jamie@studio.co", paymentDetails: "Bank transfer · Account: 12345678 · Sort code: 12-34-56" },
  { id: "INV-006", client: "Crescent Studio", clientEmail: "hello@crescentstudio.io", description: "Motion graphics – product launch", amount: 2750, dueDate: "Apr 28, 2024", dueDateISO: "2024-04-28", status: "Paid", daysPastDue: 0, sentFrom: "jamie@studio.co", paymentDetails: "Bank transfer · Account: 12345678 · Sort code: 12-34-56" },
  { id: "INV-007", client: "Volta Creative", clientEmail: "accounts@voltacreative.com", description: "Copywriting – 10 blog posts", amount: 1800, dueDate: "Apr 20, 2024", dueDateISO: "2024-04-20", status: "Paid", daysPastDue: 0, sentFrom: "jamie@studio.co", paymentDetails: "Bank transfer · Account: 12345678 · Sort code: 12-34-56" },
  { id: "INV-008", client: "Drift & Co.", clientEmail: "finance@driftandco.com", description: "Email campaign design x4", amount: 2200, dueDate: "Apr 15, 2024", dueDateISO: "2024-04-15", status: "Paid", daysPastDue: 0, sentFrom: "jamie@studio.co", paymentDetails: "Bank transfer · Account: 12345678 · Sort code: 12-34-56" },
  { id: "INV-009", client: "Prism Works", clientEmail: "billing@prismworks.io", description: "UX audit & recommendations", amount: 3800, dueDate: "Jun 12, 2024", dueDateISO: "2024-06-12", status: "Upcoming", daysPastDue: 0, sentFrom: "jamie@studio.co", paymentDetails: "Bank transfer · Account: 12345678 · Sort code: 12-34-56" },
  { id: "INV-010", client: "Echo Ventures", clientEmail: "ap@echoventures.co", description: "Pitch deck design", amount: 2100, dueDate: "May 14, 2024", dueDateISO: "2024-05-14", status: "Overdue", daysPastDue: 24, sentFrom: "jamie@studio.co", paymentDetails: "Bank transfer · Account: 12345678 · Sort code: 12-34-56" },
  { id: "INV-011", client: "Harbour & Fox", clientEmail: "billing@harbourandfox.com", description: "Brand guidelines & visual identity", amount: 7200, dueDate: "Apr 5, 2024", dueDateISO: "2024-04-05", status: "Paid", daysPastDue: 0, sentFrom: "jamie@studio.co", paymentDetails: "Bank transfer · Account: 12345678 · Sort code: 12-34-56" },
  { id: "INV-012", client: "Vantage Creative", clientEmail: "accounts@vantagecreative.io", description: "Product photography & editing", amount: 3400, dueDate: "Apr 10, 2024", dueDateISO: "2024-04-10", status: "Paid", daysPastDue: 0, sentFrom: "jamie@studio.co", paymentDetails: "Bank transfer · Account: 12345678 · Sort code: 12-34-56" },
];

export function getStats() {
  const outstanding = INVOICES.filter((i) => i.status !== "Paid");
  const overdue = INVOICES.filter((i) => i.status === "Escalated" || i.status === "Overdue");
  const paid = INVOICES.filter((i) => i.status === "Paid");
  return {
    outstandingTotal: outstanding.reduce((s, i) => s + i.amount, 0),
    outstandingCount: outstanding.length,
    overdueTotal: overdue.reduce((s, i) => s + i.amount, 0),
    overdueCount: overdue.length,
    paidTotal: paid.reduce((s, i) => s + i.amount, 0),
    paidCount: paid.length,
  };
}

export function getInvoiceById(id: string): Invoice | undefined {
  return INVOICES.find((i) => i.id === id);
}

export const CHASE_FEED = INVOICES.filter(
  (i) => i.status === "Escalated" || i.status === "Overdue" || i.status === "Follow-up"
).sort((a, b) => b.daysPastDue - a.daysPastDue);

export const ACTIVITY: ActivityItem[] = [
  { id: "act-1", invoiceId: "INV-012", client: "Vantage Creative", description: "Payment of $3,400 received via bank transfer", timeAgo: "2 hours ago", type: "payment" },
  { id: "act-2", invoiceId: "INV-002", client: "Momentum Labs", description: "Automated 2nd reminder email delivered", timeAgo: "4 hours ago", type: "reminder" },
  { id: "act-3", invoiceId: "INV-001", client: "Apex Digital", description: "Auto-escalated after 21 days with no response", timeAgo: "1 day ago", type: "escalation" },
  { id: "act-4", invoiceId: "INV-003", client: "Fieldstone Co.", description: "Client opened the invoice link (3 views)", timeAgo: "1 day ago", type: "view" },
  { id: "act-5", invoiceId: "INV-010", client: "Echo Ventures", description: "Automated 3rd reminder email delivered", timeAgo: "2 days ago", type: "reminder" },
  { id: "act-6", invoiceId: "INV-011", client: "Harbour & Fox", description: "Payment of $7,200 received in full", timeAgo: "3 days ago", type: "payment" },
  { id: "act-8", invoiceId: "INV-003", client: "Fieldstone Co.", description: 'Client replied: "We\'ll process payment by end of Friday"', timeAgo: "2 hours ago", type: "reply" },
];

export function formatUSD(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
