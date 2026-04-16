import { useState } from "react";
import { Calendar, Check, Edit2, X } from "lucide-react";
import type { Invoice } from "@/lib/data";

type DotState = "done" | "active" | "pending" | "resolved";

interface TimelineEvent {
  label: string;
  date: string;
  state: DotState;
  editable?: boolean;
}

const DOT_COLORS: Record<DotState, string> = {
  done: "hsl(var(--chart-2))",
  active: "hsl(var(--primary))",
  pending: "hsl(var(--border))",
  resolved: "hsl(var(--chart-2))",
};

function getTimeline(invoice: Invoice, customDates?: Record<number, string>): TimelineEvent[] {
  const due = new Date(invoice.dueDateISO);
  const sentDate = new Date(due);
  sentDate.setDate(sentDate.getDate() - 30);

  const defaults: string[] = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(sentDate);
    d.setDate(d.getDate() + i * 7);
    defaults.push(d.toISOString().split("T")[0]);
  }

  const dates = defaults.map((d, i) => customDates?.[i] ?? d);
  const formatted = dates.map((d) =>
    new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
  );

  const base: TimelineEvent[] = [
    { label: "Invoice sent", date: formatted[0], state: "done", editable: false },
    { label: "1st reminder", date: formatted[1], state: "pending", editable: true },
    { label: "2nd reminder", date: formatted[2], state: "pending", editable: true },
    { label: "Final notice", date: formatted[3], state: "pending", editable: true },
    { label: "Resolved", date: "", state: "pending", editable: false },
  ];

  if (invoice.status === "Paid")
    return base.map((e) => ({ ...e, state: (e.label === "Resolved" ? "resolved" : "done") as DotState, editable: false }));
  if (invoice.status === "Escalated")
    return base.map((e, i) => ({ ...e, state: (i < 4 ? "done" : "active") as DotState, editable: false }));
  if (invoice.status === "Overdue")
    return base.map((e, i) => ({ ...e, state: (i <= 1 ? "done" : i === 2 ? "active" : "pending") as DotState, editable: i > 2 }));
  if (invoice.status === "Follow-up")
    return base.map((e, i) => ({ ...e, state: (i === 0 ? "done" : i === 1 ? "active" : "pending") as DotState, editable: i > 1 }));
  return base;
}

export default function ChaseTimeline({ invoice }: { invoice: Invoice }) {
  const [editing, setEditing] = useState(false);
  const [customDates, setCustomDates] = useState<Record<number, string>>({});

  // Compute raw ISO dates for the input fields
  const due = new Date(invoice.dueDateISO);
  const sentDate = new Date(due);
  sentDate.setDate(sentDate.getDate() - 30);
  const rawDates: string[] = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(sentDate);
    d.setDate(d.getDate() + i * 7);
    rawDates.push(d.toISOString().split("T")[0]);
  }

  const timeline = getTimeline(invoice, customDates);
  const hasEditableSteps = timeline.some((e) => e.editable);

  function handleDateChange(idx: number, value: string) {
    setCustomDates((prev) => ({ ...prev, [idx]: value }));
  }

  return (
    <div className="mt-5 bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Chase Timeline</h3>
        {hasEditableSteps && !editing && (
          <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-xs text-primary font-medium">
            <Edit2 className="w-3 h-3" /> Edit
          </button>
        )}
        {editing && (
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="flex items-center gap-1 text-xs text-primary font-medium">
              <Check className="w-3 h-3" /> Done
            </button>
          </div>
        )}
      </div>

      {/* Connector line + dots */}
      <div className="relative">
        <div className="flex items-start gap-0">
          {timeline.map((ev, i) => (
            <div key={i} className="flex-1 flex flex-col items-center text-center">
              <div
                className="w-3.5 h-3.5 rounded-full border-2 shrink-0"
                style={{
                  backgroundColor: ev.state !== "pending" ? DOT_COLORS[ev.state] : "transparent",
                  borderColor: DOT_COLORS[ev.state],
                }}
              />
              <p className="text-[10px] font-medium text-foreground mt-1.5 leading-tight">{ev.label}</p>
              {editing && ev.editable ? (
                <input
                  type="date"
                  value={customDates[i] ?? rawDates[i]}
                  onChange={(e) => handleDateChange(i, e.target.value)}
                  className="mt-1 text-[10px] w-[90px] px-1 py-0.5 rounded border border-primary/30 bg-muted text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
              ) : (
                ev.date && <p className="text-[9px] text-muted-foreground">{ev.date}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
