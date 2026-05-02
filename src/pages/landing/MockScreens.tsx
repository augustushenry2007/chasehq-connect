import { useEffect, useState } from "react";
import { ChevronRight, Search, Sparkles } from "lucide-react";

// Frame 1 — "Add invoice": a New Invoice modal mid-fill.
export function MockAddInvoice() {
  return (
    <div className="h-full px-3 pt-2 flex flex-col bg-background">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">New Invoice</p>
      <div className="space-y-2">
        <Field label="Client" value="Acme Co." />
        <Field label="Amount" value="$4,200" />
        <Field label="Due date" value="May 15" />
        <Field label="Description" value="Brand identity — phase 2" />
      </div>
      <div className="mt-auto mb-3">
        <div className="bg-primary text-primary-foreground rounded-xl text-[11px] font-semibold py-2 text-center">
          Add invoice
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border border-border rounded-lg px-2.5 py-1.5">
      <p className="text-[8px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      <p className="text-[11px] text-foreground font-medium truncate">{value}</p>
    </div>
  );
}

// Frame 2 — "ChaseHQ drafts": AI Draft Composer-style preview.
export function MockDraft() {
  return (
    <div className="h-full px-3 pt-2 flex flex-col bg-background">
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles className="w-3 h-3 text-primary" />
        <p className="text-[10px] font-semibold text-foreground">AI Draft</p>
        <span className="ml-auto text-[8px] uppercase tracking-wider text-muted-foreground">Friendly</span>
      </div>
      <div className="bg-card border border-border rounded-xl p-2.5 flex-1 overflow-hidden">
        <p className="text-[9px] text-muted-foreground mb-1">To: sarah@acme.co</p>
        <p className="text-[9px] text-muted-foreground mb-2">Subject: quick nudge — invoice #1042</p>
        <div className="space-y-1.5">
          <p className="text-[10px] text-foreground leading-snug">Hey Sarah,</p>
          <p className="text-[10px] text-foreground leading-snug">
            Quick nudge on invoice #1042 — let me know if anything's holding it up. Happy to clarify or split it if helpful.
          </p>
          <p className="text-[10px] text-foreground leading-snug">Thanks!</p>
        </div>
      </div>
      <div className="mt-2 mb-3">
        <div className="bg-primary text-primary-foreground rounded-xl text-[11px] font-semibold py-2 text-center">
          Send follow-up
        </div>
      </div>
    </div>
  );
}

// Frame 3 — "Get paid": invoice list with a row flipping Overdue → Paid on a timer.
export function MockGetPaid() {
  const [acmePaid, setAcmePaid] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setAcmePaid((p) => !p), 3200);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="h-full flex flex-col bg-background">
      <div className="px-3 pt-1 pb-2">
        <p className="text-[12px] font-bold text-foreground">Follow-Ups</p>
        <div className="mt-1.5 flex items-center gap-1.5 bg-card border border-border rounded-lg px-2 py-1">
          <Search className="w-2.5 h-2.5 text-muted-foreground" />
          <span className="text-[9px] text-muted-foreground">Search invoices…</span>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <Row client="Acme Co." amount="$4,200" status={acmePaid ? "Paid" : "Overdue"} highlighted />
        <Row client="Northwind" amount="$1,850" status="Upcoming" />
        <Row client="Globex" amount="$2,300" status="Paid" />
        <Row client="Initech" amount="$3,100" status="Overdue" />
      </div>
    </div>
  );
}

function Row({
  client,
  amount,
  status,
  highlighted = false,
}: {
  client: string;
  amount: string;
  status: "Paid" | "Overdue" | "Upcoming";
  highlighted?: boolean;
}) {
  const pillClass =
    status === "Paid"
      ? "bg-success-bg text-success"
      : status === "Overdue"
        ? "bg-error-bg text-destructive"
        : "bg-accent text-accent-foreground";
  return (
    <div
      className={`flex items-center justify-between px-3 py-2 border-b border-border transition-colors duration-500 ${
        highlighted ? "bg-accent/30" : ""
      }`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-foreground truncate">{client}</p>
        <span
          className={`inline-block mt-1 text-[8px] font-semibold px-1.5 py-0.5 rounded transition-colors duration-500 ${pillClass}`}
        >
          {status}
        </span>
      </div>
      <div className="flex items-center gap-1 shrink-0 ml-2">
        <span className="text-[11px] font-semibold text-foreground">{amount}</span>
        <ChevronRight className="w-2.5 h-2.5 text-muted-foreground" />
      </div>
    </div>
  );
}
