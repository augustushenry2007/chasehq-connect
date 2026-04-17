import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useInvoices, deleteInvoice } from "@/hooks/useSupabaseData";
import { getInvoiceById, formatUSD } from "@/lib/data";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowLeft, ChevronDown, Mail, MessageSquare, Trash2 } from "lucide-react";
import ChaseTimeline from "@/components/invoice/ChaseTimeline";
import AIDraftComposer from "@/components/invoice/AIDraftComposer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function InvoiceDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { invoices, refetch } = useInvoices();
  const invoice = getInvoiceById(id || "", invoices);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!invoice) return;
    setDeleting(true);
    const ok = await deleteInvoice(invoice.id);
    setDeleting(false);
    if (ok) {
      await refetch();
      navigate("/invoices");
    }
  }

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
      <div className="px-5 pt-5 pb-2 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-muted-foreground">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back to Invoices</span>
        </button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              aria-label="Delete invoice"
              className="p-2 -mr-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this invoice?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. All follow-ups and history for this invoice will be permanently removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? "Deleting…" : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
          <div className="mt-4 bg-primary/5 border border-primary/20 rounded-xl p-4">
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
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${detailsOpen ? "rotate-180" : ""}`} />
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
