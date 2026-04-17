import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import QuickstartLayout from "./QuickstartLayout";
import { useApp } from "@/context/AppContext";
import { createInvoice } from "@/hooks/useSupabaseData";
import { Loader2 } from "lucide-react";

type StatusChip = "Upcoming" | "Follow-up" | "Overdue";

const STATUS_OPTIONS: { value: StatusChip; label: string; sub: string; days: number }[] = [
  { value: "Upcoming", label: "Due soon", sub: "in the next week", days: 5 },
  { value: "Follow-up", label: "Due today", sub: "or this week", days: 0 },
  { value: "Overdue", label: "Overdue", sub: "past due", days: -10 },
];

export default function InvoiceScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const isDemo = params.get("demo") === "1";
  const { user } = useApp();

  const [client, setClient] = useState(isDemo ? "Acme Co" : "");
  const [clientEmail, setClientEmail] = useState(isDemo ? "billing@acme.example" : "");
  const [amount, setAmount] = useState<string>(isDemo ? "1200" : "");
  const [status, setStatus] = useState<StatusChip>(isDemo ? "Overdue" : "Follow-up");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isDemo) {
      setClient("Acme Co");
      setClientEmail("billing@acme.example");
      setAmount("1200");
      setStatus("Overdue");
    }
  }, [isDemo]);

  const canContinue = client.trim().length > 0 && clientEmail.trim().length > 0;

  async function handleContinue() {
    if (!user || !canContinue) return;
    setSubmitting(true);
    const opt = STATUS_OPTIONS.find((s) => s.value === status)!;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + opt.days);
    const dueDateISO = dueDate.toISOString().slice(0, 10);

    const inv = await createInvoice(user.id, {
      client: client.trim(),
      clientEmail: clientEmail.trim(),
      description: "",
      amount: amount ? Number(amount) : 0,
      dueDate: dueDateISO,
    });
    setSubmitting(false);
    if (inv) {
      navigate(`/quickstart/draft?invoice=${inv.invoice_number}&status=${status}`);
    }
  }

  return (
    <QuickstartLayout step={3} showBack onBack={() => navigate("/quickstart/ask")}>
      <div className="flex-1">
        <h1 className="text-2xl font-bold text-foreground leading-tight">
          Tell us the basics
        </h1>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          Just enough to draft a thoughtful message. Three fields.
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Client name</label>
            <input
              value={client}
              onChange={(e) => setClient(e.target.value)}
              placeholder="e.g. Acme Co"
              className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Client email</label>
            <input
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="billing@acme.com"
              className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Amount <span className="text-muted-foreground/60">(optional)</span></label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1,200"
                className="w-full bg-muted border border-border rounded-xl pl-8 pr-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Status</label>
            <div className="grid grid-cols-3 gap-2">
              {STATUS_OPTIONS.map((s) => {
                const selected = status === s.value;
                return (
                  <button
                    key={s.value}
                    onClick={() => setStatus(s.value)}
                    className={`flex flex-col items-center text-center px-2 py-3 rounded-xl border transition-all ${
                      selected
                        ? "bg-primary/10 border-primary text-foreground"
                        : "bg-muted border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    <span className="text-xs font-semibold">{s.label}</span>
                    <span className="text-[10px] mt-0.5 opacity-70">{s.sub}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <button
        onClick={handleContinue}
        disabled={!canContinue || submitting}
        className="w-full bg-primary text-primary-foreground rounded-xl py-3.5 text-base font-semibold mt-6 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
        {submitting ? "Drafting…" : "Draft my follow-up"}
      </button>
    </QuickstartLayout>
  );
}
