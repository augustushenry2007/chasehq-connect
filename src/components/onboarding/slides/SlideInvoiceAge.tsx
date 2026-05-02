import { useEffect, useState } from "react";

const SAMPLE_INVOICES = [
  { client: "Acme Corp",    id: "#1041", days: 21, amount: "$2,400", color: "bg-red-500" },
  { client: "Blue Studio",  id: "#1038", days: 14, amount: "$890",   color: "bg-orange-500" },
  { client: "Nova Agency",  id: "#1036", days: 7,  amount: "$1,200", color: "bg-amber-500" },
];

export function SlideInvoiceAge() {
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setVisible((n) => Math.min(n + 1, SAMPLE_INVOICES.length));
    }, 600);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col gap-5 px-2">
      <div className="text-center">
        <h2 className="text-xl font-bold text-foreground mb-1">Invoice Age & the Chase Feed</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The longer an invoice sits unpaid, the higher it rises in your chase feed. Nothing gets buried.
        </p>
      </div>

      {/* Mock chase feed */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-border">
          <p className="text-sm font-semibold text-foreground">Chase Feed</p>
          <p className="text-xs text-muted-foreground">Prioritized actions</p>
        </div>
        {SAMPLE_INVOICES.map((inv, i) => (
          <div
            key={inv.id}
            className={`flex items-center gap-3 px-4 py-3 border-b border-border last:border-none transition-all duration-500 ${i < visible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"}`}
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${inv.color}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">{inv.client}</p>
              <p className="text-xs text-muted-foreground">{inv.days} days overdue</p>
            </div>
            <span className="text-sm font-semibold text-foreground shrink-0">{inv.amount}</span>
          </div>
        ))}
      </div>

      <p className="text-sm text-muted-foreground font-medium text-center px-4">
        Tapping any row opens the invoice and shows its full chase schedule.
      </p>
    </div>
  );
}
