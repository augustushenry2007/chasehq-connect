import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getInvoiceById, ACTIVITY, formatUSD, type Invoice, type InvoiceStatus } from "@/lib/data";
import { StatusBadge, STATUS_CONFIG } from "@/components/StatusBadge";
import { ArrowLeft, ChevronDown, ChevronUp, RefreshCw, Send, Mail, MessageSquare } from "lucide-react";

type Tone = "Polite" | "Friendly" | "Firm" | "Urgent";
const TONES: Tone[] = ["Polite", "Friendly", "Firm", "Urgent"];

type DotState = "done" | "active" | "pending" | "resolved";

interface TimelineEvent {
  label: string;
  date: string;
  state: DotState;
}

function getTimeline(invoice: Invoice): TimelineEvent[] {
  const due = new Date(invoice.dueDateISO);
  const sentDate = new Date(due);
  sentDate.setDate(sentDate.getDate() - 30);
  const dates: string[] = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(sentDate);
    d.setDate(d.getDate() + i * 7);
    dates.push(d.toLocaleDateString("en-US", { month: "short", day: "numeric" }));
  }

  const base: TimelineEvent[] = [
    { label: "Invoice sent", date: dates[0], state: "done" },
    { label: "1st reminder", date: dates[1], state: "pending" },
    { label: "2nd reminder", date: dates[2], state: "pending" },
    { label: "Final notice", date: dates[3], state: "pending" },
    { label: "Resolved", date: "", state: "pending" },
  ];

  if (invoice.status === "Paid") return base.map((e) => ({ ...e, state: e.label === "Resolved" ? "resolved" as const : "done" as const }));
  if (invoice.status === "Escalated") return base.map((e, i) => ({ ...e, state: (i < 4 ? "done" : "active") as DotState }));
  if (invoice.status === "Overdue") return base.map((e, i) => ({ ...e, state: (i <= 1 ? "done" : i === 2 ? "active" : "pending") as DotState }));
  if (invoice.status === "Follow-up") return base.map((e, i) => ({ ...e, state: (i === 0 ? "done" : i === 1 ? "active" : "pending") as DotState }));
  return base;
}

function getDraft(invoice: Invoice, tone: Tone, variant: number): string {
  const drafts: Record<Tone, string[]> = {
    Polite: [
      `Hi ${invoice.client} team,\n\nI hope you're well. I'm writing to kindly follow up on invoice ${invoice.id} for ${formatUSD(invoice.amount)}, which was due on ${invoice.dueDate}.\n\nIf there's been an oversight, no worries at all — I'd just appreciate a quick update when you get a chance.\n\nThanks so much,\nJamie Doe`,
      `Hello,\n\nI hope things are going well. I wanted to gently check in on invoice ${invoice.id} (${formatUSD(invoice.amount)}, due ${invoice.dueDate}).\n\nIf anything is holding up payment, I'm happy to chat and find a solution.\n\nWarm regards,\nJamie`,
      `Dear ${invoice.client},\n\nFollowing up on invoice ${invoice.id} for ${formatUSD(invoice.amount)}${invoice.daysPastDue > 0 ? `, now ${invoice.daysPastDue} days overdue` : ""}.\n\nCould you let me know when I might expect payment?\n\nThank you,\nJamie Doe`,
    ],
    Friendly: [
      `Hi there,\n\nJust a quick reminder that invoice ${invoice.id} for ${formatUSD(invoice.amount)} is${invoice.daysPastDue > 0 ? ` now ${invoice.daysPastDue} days overdue (due ${invoice.dueDate})` : ` due on ${invoice.dueDate}`}.\n\nCould you let me know if everything is in order?\n\nThanks,\nJamie`,
      `Hey,\n\nChecking in on invoice ${invoice.id} for ${formatUSD(invoice.amount)} — just want to make sure it didn't slip through the cracks!\n\nLet me know if you need anything from my side.\n\nCheers,\nJamie`,
      `Hi ${invoice.client} team,\n\nHope all is well! Noticed invoice ${invoice.id} (${formatUSD(invoice.amount)}) hasn't come through yet. Happy to resend details if helpful.\n\nBest,\nJamie`,
    ],
    Firm: [
      `Hi,\n\nI'm writing to formally request payment for invoice ${invoice.id} (${formatUSD(invoice.amount)}), now ${invoice.daysPastDue} days past due.\n\nPlease arrange payment within 7 days or contact me to discuss.\n\nRegards,\nJamie Doe`,
      `Dear ${invoice.client},\n\nInvoice ${invoice.id} for ${formatUSD(invoice.amount)} remains outstanding. I need to know when payment will be made.\n\nPlease respond by end of week.\n\nJamie Doe`,
      `To the accounts team,\n\nThis is a formal reminder: invoice ${invoice.id} for ${formatUSD(invoice.amount)} is ${invoice.daysPastDue} days overdue. Continued delays may require escalation.\n\nJamie Doe`,
    ],
    Urgent: [
      `URGENT: Invoice ${invoice.id} for ${formatUSD(invoice.amount)} is ${invoice.daysPastDue} days overdue. Immediate payment required. If I don't hear back within 48 hours, I will pursue formal collection proceedings.\n\nJamie Doe`,
      `This is final notice for invoice ${invoice.id} (${formatUSD(invoice.amount)}). Payment must be received within 48 hours or this matter will be escalated to a collections agency.\n\nJamie Doe`,
      `FINAL NOTICE: Invoice ${invoice.id} is now critically overdue. ${formatUSD(invoice.amount)} must be paid immediately. Legal action will commence if payment is not received within 24 hours.\n\nJamie Doe`,
    ],
  };
  return drafts[tone][variant % 3];
}

const DOT_COLORS: Record<DotState, string> = {
  done: "#16A34A",
  active: "#0EA5E9",
  pending: "#D1D5DB",
  resolved: "#16A34A",
};

export default function InvoiceDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const invoice = getInvoiceById(id || "");

  const [tone, setTone] = useState<Tone>("Friendly");
  const [variantIndex, setVariantIndex] = useState(0);
  const [customDraft, setCustomDraft] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [sent, setSent] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(true);

  if (!invoice) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <p className="text-lg font-semibold text-foreground">Invoice not found</p>
        <button onClick={() => navigate(-1)} className="text-sm font-medium text-primary">Go back</button>
      </div>
    );
  }

  const timeline = getTimeline(invoice);
  const currentDraft = customDraft ?? getDraft(invoice, tone, variantIndex);
  const invoiceActivity = ACTIVITY.filter((a) => a.invoiceId === invoice.id);

  function handleToneChange(t: Tone) {
    setTone(t);
    setCustomDraft(null);
    setVariantIndex(0);
  }

  function handleRegenerate() {
    setIsGenerating(true);
    setCustomDraft(null);
    setTimeout(() => { setVariantIndex((v) => (v + 1) % 3); setIsGenerating(false); }, 800);
  }

  function handleSend() {
    setSent(true);
    setTimeout(() => setSent(false), 2500);
  }

  const detailRows = [
    { label: "Invoice ID", value: invoice.id },
    { label: "Client", value: invoice.client },
    { label: "Email", value: invoice.clientEmail },
    { label: "Amount", value: formatUSD(invoice.amount) },
    { label: "Due date", value: invoice.dueDate },
    ...(invoice.daysPastDue > 0 ? [{ label: "Overdue by", value: `${invoice.daysPastDue} days`, color: "#DC2626" }] : []),
    { label: "Sent from", value: invoice.sentFrom },
    { label: "Payment", value: invoice.paymentDetails },
  ];

  return (
    <div className="flex-1 overflow-auto pb-24">
      {/* Top bar */}
      <div className="px-5 pt-5 pb-2">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-muted-foreground">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back to Invoices</span>
        </button>
      </div>

      <div className="px-5">
        {/* Hero */}
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

        {/* Client Reply */}
        {invoice.clientReply && (
          <div className="mt-4 bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-3.5 h-3.5 text-[#2563EB]" />
              <span className="text-xs font-semibold text-[#2563EB]">Client replied · {invoice.clientReply.receivedAt}</span>
            </div>
            <p className="text-sm text-foreground italic">"{invoice.clientReply.snippet}"</p>
            <p className="text-xs text-muted-foreground mt-1">From: {invoice.clientReply.senderEmail}</p>
          </div>
        )}

        {/* Timeline */}
        <div className="mt-5 bg-card border border-border rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Chase Timeline</h3>
          <div className="flex items-center gap-0">
            {timeline.map((ev, i) => (
              <div key={i} className="flex-1 flex flex-col items-center text-center">
                <div className="w-3 h-3 rounded-full border-2" style={{ backgroundColor: ev.state !== "pending" ? DOT_COLORS[ev.state] : "transparent", borderColor: DOT_COLORS[ev.state] }} />
                <p className="text-[10px] font-medium text-foreground mt-1.5 leading-tight">{ev.label}</p>
                {ev.date && <p className="text-[9px] text-muted-foreground">{ev.date}</p>}
              </div>
            ))}
          </div>
        </div>

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

        {/* Draft Composer */}
        {invoice.status !== "Paid" && (
          <div className="mt-4 bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Follow-up Draft</h3>
              <div className="flex items-center gap-1.5">
                <button onClick={handleRegenerate} disabled={isGenerating} className="flex items-center gap-1 text-xs font-medium text-primary">
                  <RefreshCw className={`w-3 h-3 ${isGenerating ? "animate-spin" : ""}`} /> Regenerate
                </button>
              </div>
            </div>

            <div className="flex gap-1.5 mb-3">
              {TONES.map((t) => (
                <button
                  key={t}
                  onClick={() => handleToneChange(t)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${tone === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                >
                  {t}
                </button>
              ))}
            </div>

            <textarea
              value={currentDraft}
              onChange={(e) => setCustomDraft(e.target.value)}
              rows={8}
              className="w-full bg-muted border border-border rounded-xl px-3.5 py-3 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            />

            <div className="flex gap-2.5 mt-3">
              <button
                onClick={handleSend}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-colors ${sent ? "bg-[#16A34A] text-primary-foreground" : "bg-dark text-primary-foreground"}`}
              >
                {sent ? "Sent ✓" : <><Send className="w-4 h-4" /> Send via Gmail</>}
              </button>
            </div>
          </div>
        )}

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
