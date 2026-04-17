import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useInvoices } from "@/hooks/useSupabaseData";
import { getInvoiceById, formatUSD } from "@/lib/data";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowLeft, ChevronDown, ChevronUp, Mail, MessageSquare } from "lucide-react";
import ChaseTimeline from "@/components/invoice/ChaseTimeline";
import AIDraftComposer from "@/components/invoice/AIDraftComposer";

export default function InvoiceDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { invoices } = useInvoices();
  const invoice = getInvoiceById(id || "", invoices);
  const [detailsOpen, setDetailsOpen] = useState(true);

  if (!invoice) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <p className="text-lg font-semibold text-foreground">Invoice not found</p>
        <button onClick={() => navigate(-1)} className="text-sm font-medium text-primary">Go back</button>
      </div>
    );
  }

  const invoiceActivity: { id: string; description: string; timeAgo: string }[] = [];

  const detailRows = [
    { label: "Invoice ID", value: invoice.id },
    { label: "Client", value: invoice.client },
    { label: "Email", value: invoice.clientEmail },
    { label: "Amount", value: formatUSD(invoice.amount) },
    { label: "Due date", value: invoice.dueDate },
    ...(invoice.daysPastDue > 0 ? [{ label: "Overdue by", value: `${invoice.daysPastDue} days`, color: "hsl(var(--destructive))" }] : []),
    { label: "Sent from", value: invoice.sentFrom },
    { label: "Payment", value: invoice.paymentDetails },
  ];

  return (
    <div className="h-screen overflow-y-auto bg-background pb-24">
      <div className="px-5 pt-5 pb-2">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-muted-foreground">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back to Invoices</span>
        </button>
      </div>

      <div className="px-5">
        {/* Header */}
        <div className="flex items-start justify-between mt-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-foreground truncate">{invoice.client}</h1>
            <p className="text-sm text-muted-foreground truncate">{invoice.description}</p>
          </div>
          <div className="text-right shrink-0 ml-3">
            <p className="text-xl font-bold text-foreground">{formatUSD(invoice.amount)}</p>
            <div className="mt-1.5"><StatusBadge status={invoice.status} /></div>
          </div>
        </div>

        {/* Client reply */}
        {invoice.clientReply && (
          <div className="mt-4 bg-accent/30 border border-accent rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-semibold text-primary">Client replied · {invoice.clientReply.receivedAt}</span>
            </div>
            <p className="text-sm text-foreground italic">"{invoice.clientReply.snippet}"</p>
            <p className="text-xs text-muted-foreground mt-1">From: {invoice.clientReply.senderEmail}</p>
          </div>
        )}

        {/* Timeline */}
        <ChaseTimeline invoice={invoice} />

        {/* Details */}
        <div className="mt-4 bg-card border border-border rounded-2xl overflow-hidden">
          <button onClick={() => setDetailsOpen(!detailsOpen)} className="w-full flex items-center justify-between px-4 py-3">
            <span className="text-sm font-semibold text-foreground">Invoice Details</span>
            {detailsOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          {detailsOpen && (
            <div className="border-t border-border">
              {detailRows.map((r, i) => (
                <div key={r.label} className={`flex items-start justify-between px-4 py-2.5 ${i < detailRows.length - 1 ? "border-b border-border" : ""}`}>
                  <span className="text-xs text-muted-foreground">{r.label}</span>
                  <span className="text-xs font-medium text-right max-w-[60%]" style={{ color: (r as any).color || "hsl(var(--foreground))" }}>{r.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Draft Composer */}
        {invoice.status !== "Paid" && <AIDraftComposer invoice={invoice} />}

        {/* Activity */}
        {invoiceActivity.length > 0 && (
          <div className="mt-4 bg-card border border-border rounded-2xl p-4 mb-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Activity</h3>
            {invoiceActivity.map((item, i) => (
              <div key={item.id} className={`flex items-start gap-3 py-2.5 ${i < invoiceActivity.length - 1 ? "border-b border-border" : ""}`}>
                <Mail className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-foreground">{item.description}</p>
                  <p className="text-xs text-muted-foreground">{item.timeAgo}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
