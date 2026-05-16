import { useScrollReveal } from "./useScrollReveal";

export default function DreadVsRelief() {
  const ref = useScrollReveal<HTMLDivElement>();
  return (
    <section className="px-6 py-24 sm:py-28 bg-background">
      <div ref={ref} className="reveal max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* DREAD side — peachy/cream */}
        <div className="rounded-3xl p-8 sm:p-10 bg-orange-50 border border-orange-100">
          <h3 className="text-[26px] font-semibold text-foreground tracking-tight mb-3">Without ChaseHQ</h3>
          <p className="text-[15px] text-muted-foreground leading-relaxed mb-7 max-w-[36ch]">
            Eight unpaid invoices. Three half-written follow-ups in your drafts. The sinking feeling every time you open Gmail.
          </p>
          <div className="relative">
            <div className="bg-white rounded-2xl p-4 shadow-sm relative z-10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted-foreground">Draft · invoice #984</span>
                <span className="text-xs text-muted-foreground">3 days ago</span>
              </div>
              <div className="space-y-2">
                <div className="h-2.5 bg-muted rounded w-[85%]" />
                <div className="h-2.5 bg-muted rounded w-[72%]" />
                <div className="h-2.5 bg-muted rounded w-[60%]" />
                <div className="h-2.5 bg-muted rounded w-[40%]" />
              </div>
            </div>
            <div className="absolute -bottom-3 left-6 right-2 bg-white/80 rounded-2xl p-3 z-0 opacity-60 -rotate-1 shadow-sm">
              <div className="text-[11px] text-muted-foreground mb-1.5">Draft · invoice #1011 · 2 wk ago</div>
              <div className="h-2 bg-muted/70 rounded w-[70%]" />
            </div>
          </div>
        </div>

        {/* RELIEF side — clean white */}
        <div className="rounded-3xl p-8 sm:p-10 bg-white border border-border">
          <h3 className="text-[26px] font-semibold text-primary tracking-tight mb-3">With ChaseHQ</h3>
          <p className="text-[15px] text-muted-foreground leading-relaxed mb-7 max-w-[36ch]">
            A calm timeline. Every follow-up handled. Money in, anxiety out.
          </p>
          <div className="bg-card rounded-2xl border border-border divide-y divide-border overflow-hidden">
            <InvoiceRow initial="A" client="Acme Co" inv="#1042" amount="$2,400" sub="6 days late" status="Overdue" tone="overdue" />
            <InvoiceRow initial="N" client="Northwind" inv="#1039" amount="$1,800" sub="nudged today" status="Sent" tone="sent" />
            <InvoiceRow initial="F" client="Finch Studio" inv="#1031" amount="$3,200" sub="cleared" status="Paid ✓" tone="paid" />
          </div>
        </div>
      </div>
    </section>
  );
}

type Tone = "overdue" | "sent" | "paid";

function InvoiceRow({
  initial,
  client,
  inv,
  amount,
  sub,
  status,
  tone,
}: {
  initial: string;
  client: string;
  inv: string;
  amount: string;
  sub: string;
  status: string;
  tone: Tone;
}) {
  const badgeCls =
    tone === "overdue"
      ? "bg-orange-100 text-orange-700"
      : tone === "sent"
      ? "bg-blue-100 text-blue-700"
      : "bg-green-100 text-green-700";
  const avatarCls =
    tone === "overdue"
      ? "bg-orange-100 text-orange-700"
      : tone === "sent"
      ? "bg-blue-100 text-blue-700"
      : "bg-green-100 text-green-700";
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${avatarCls}`}>
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground truncate">
          {client} · {inv}
        </div>
        <div className="text-xs text-muted-foreground">
          {amount} · {sub}
        </div>
      </div>
      <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${badgeCls}`}>{status}</span>
    </div>
  );
}
