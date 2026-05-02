import { useState, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useInvoices, deleteInvoice, markInvoicePaid } from "@/hooks/useSupabaseData";
import { cancelForInvoice } from "@/lib/localNotifications";
import { getInvoiceById, formatUSD, formatDate, type Invoice, type InvoiceStatus } from "@/lib/data";
import { FileX } from "lucide-react";
import type { ScheduleStep } from "@/lib/scheduleDefaults";
import { getStartingTone } from "@/lib/scheduleDefaults";
import { readPending, type PendingInvoice } from "@/lib/localInvoice";
import NewInvoiceModal from "@/components/invoice/NewInvoiceModal";
import { StatusBadge } from "@/components/StatusBadge";
import { CheckCircle2, ChevronDown, MessageSquare, Trash2 } from "lucide-react";
import { ScreenHeader } from "@/components/ScreenHeader";
import { toast } from "sonner";
import { analytics } from "@/lib/analytics";
import ChaseSchedule from "@/components/invoice/ChaseSchedule";
import AIDraftComposer from "@/components/invoice/AIDraftComposer";
import { useApp } from "@/context/AppContext";
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

function pendingToInvoice(p: PendingInvoice): Invoice {
  return {
    id: "guest",
    dbId: "guest",
    client: p.client,
    clientEmail: p.clientEmail,
    description: p.description,
    amount: p.amount,
    dueDate: formatDate(p.dueDate),
    dueDateISO: p.dueDate,
    status: "Upcoming",
    daysPastDue: 0,
    sentFrom: "",
    paymentDetails: "",
  };
}

export default function InvoiceDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { invoices, loading: invoicesLoading, refetch } = useInvoices();
  const { isAuthenticated } = useApp();
  const isGuestPreview = id === "guest";
  const pending = isGuestPreview ? readPending() : null;
  const invoice = isGuestPreview
    ? (pending ? pendingToInvoice(pending) : undefined)
    : getInvoiceById(id || "", invoices);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [scheduleRefreshKey, setScheduleRefreshKey] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [activeTone, setActiveTone] = useState<ScheduleStep["tone"] | null>(null);
  const previousStatusRef = useRef<InvoiceStatus | null>(null);
  const composerRef = useRef<HTMLDivElement>(null);

  const handleSendNow = useCallback((tone: ScheduleStep["tone"]) => {
    setActiveTone(tone);
    setTimeout(() => composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  }, []);

  async function handleMarkPaid() {
    if (markingPaid || !invoice) return;
    setMarkingPaid(true);
    previousStatusRef.current = invoice.status;
    try { localStorage.setItem(`invoice_${invoice.id}_prev_status`, invoice.status); } catch {}
    const ok = await markInvoicePaid(invoice.id, true);
    if (ok) {
      await cancelForInvoice(invoice.dbId);
      await refetch();
      analytics.invoiceMarkedPaid(invoice.id, invoice.amount);
      toast.success(`Nice — ${invoice.client} is off your list.`, {
        duration: 5000,
        action: {
          label: "Undo",
          onClick: async () => {
            const restoreStatus = previousStatusRef.current ?? "Upcoming";
            await markInvoicePaid(invoice.id, false, restoreStatus);
            try { localStorage.removeItem(`invoice_${invoice.id}_prev_status`); } catch {}
            await refetch();
          },
        },
      });
    }
    setMarkingPaid(false);
  }

  async function handleUnmarkPaid() {
    if (!invoice) return;
    let restoreStatus: InvoiceStatus;
    try {
      const stored = localStorage.getItem(`invoice_${invoice.id}_prev_status`) as InvoiceStatus | null;
      restoreStatus = stored ?? (new Date(invoice.dueDateISO) < new Date() ? "Overdue" : "Upcoming");
    } catch {
      restoreStatus = new Date(invoice.dueDateISO) < new Date() ? "Overdue" : "Upcoming";
    }
    await markInvoicePaid(invoice.id, false, restoreStatus);
    try { localStorage.removeItem(`invoice_${invoice.id}_prev_status`); } catch {}
    await refetch();
  }

  async function handleDelete() {
    if (!invoice) return;
    setDeleting(true);
    const ok = await deleteInvoice(invoice.dbId);
    setDeleting(false);
    if (ok) {
      await refetch();
      navigate("/invoices");
    }
  }

  const startingTone = useMemo(() => {
    if (!invoice) return undefined;
    const dpd = Math.max(0, Math.floor((Date.now() - new Date(invoice.dueDateISO).getTime()) / 86_400_000));
    return dpd > 0 ? getStartingTone(invoice.dueDateISO) : undefined;
  }, [invoice?.dueDateISO]); // eslint-disable-line react-hooks/exhaustive-deps

  const [showNewModal, setShowNewModal] = useState(false);

  if (!isGuestPreview && !invoicesLoading && !invoice) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center">
        <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
          <FileX className="w-7 h-7 text-muted-foreground" />
        </div>
        <div>
          <p className="text-lg font-bold text-foreground">We can't find this invoice</p>
          <p className="text-sm text-muted-foreground mt-1">It may have been deleted, or this link is no longer valid.</p>
        </div>
        <div className="flex flex-col gap-2 w-full max-w-[240px]">
          <button
            onClick={() => navigate("/invoices")}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
          >
            View all follow-ups
          </button>
          <button
            onClick={() => setShowNewModal(true)}
            className="w-full py-2.5 rounded-xl border border-border bg-card text-sm font-medium text-foreground"
          >
            Create a new invoice
          </button>
        </div>
        {id && <p className="text-[11px] font-mono text-muted-foreground">ID: {id}</p>}
        <NewInvoiceModal visible={showNewModal} onClose={() => setShowNewModal(false)} onCreated={() => { setShowNewModal(false); navigate("/invoices"); }} />
      </div>
    );
  }

  if (!invoice) return null;

  const daysPastDue = Math.max(0, Math.floor((Date.now() - new Date(invoice.dueDateISO).getTime()) / 86_400_000));

  const detailRows = [
    { label: "Invoice ID", value: isGuestPreview ? "Guest" : invoice.id },
    { label: "Client", value: invoice.client },
    { label: "Email", value: invoice.clientEmail },
    { label: "Amount", value: formatUSD(invoice.amount) },
    { label: "Due date", value: invoice.dueDate },
    ...(daysPastDue > 0 ? [{ label: "Overdue by", value: `${daysPastDue} days`, color: "hsl(var(--destructive))" }] : []),
  ];

  return (
    <div className="h-screen overflow-y-auto bg-background pb-24 animate-page-enter">
      <div className="flex items-center justify-between pr-3">
        <ScreenHeader
          title="Back to Follow-ups"
          fallbackPath="/invoices"
          onBack={() => navigate("/invoices")}
        />
        {!isGuestPreview && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                aria-label="Delete invoice"
                className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
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
        )}
      </div>

      <div className="px-5">
        {/* Header */}
        <div className="flex items-start justify-between mt-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-foreground truncate capitalize">{invoice.client}</h1>
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

        {/* Chase Schedule */}
        {isAuthenticated && invoice.status !== "Paid" && (
          <ChaseSchedule invoice={invoice} refreshKey={scheduleRefreshKey} onSendNow={handleSendNow} />
        )}

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
        {invoice.status !== "Paid" && (
          <div ref={composerRef}>
            <AIDraftComposer
              invoice={invoice}
              onSent={() => setScheduleRefreshKey((k) => k + 1)}
              defaultTone={activeTone ?? startingTone}
            />
          </div>
        )}

        {/* Mark as Paid */}
        {!isGuestPreview && invoice.status !== "Paid" && (
          <div className="flex justify-center mt-4">
              <button
                onClick={handleMarkPaid}
                disabled={markingPaid}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {markingPaid ? "Marking as paid…" : "Mark as Paid"}
              </button>
          </div>
        )}
        {!isGuestPreview && invoice.status === "Paid" && (
          <div className="mt-4 flex items-center justify-between px-4 py-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Marked as Paid</span>
            </div>
            <button onClick={handleUnmarkPaid} className="text-xs text-muted-foreground underline underline-offset-2">
              Undo
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
