import { useState } from "react";
import { Check, Edit2, AlertTriangle } from "lucide-react";
import type { Invoice } from "@/lib/data";

type DotState = "done" | "active" | "pending" | "resolved" | "warning";

interface TimelineEvent {
  label: string;
  date: string;
  state: DotState;
  editable?: boolean;
  isFinal?: boolean;
}

function getTimeline(invoice: Invoice, customDates?: Record<number, string>): TimelineEvent[] {
  const due = new Date(invoice.dueDateISO);
  const safeDue = isNaN(due.getTime()) ? new Date() : due;
  const sentDate = new Date(safeDue);
  sentDate.setDate(sentDate.getDate() - 30);

  const defaults: string[] = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(sentDate);
    d.setDate(d.getDate() + i * 7);
    defaults.push(d.toISOString().split("T")[0]);
  }

  const dates = defaults.map((d, i) => customDates?.[i] ?? d);
  const formatted = dates.map((d) =>
    new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  );

  const base: TimelineEvent[] = [
    { label: "Invoice sent", date: formatted[0], state: "done", editable: false },
    { label: "1st reminder", date: formatted[1], state: "pending", editable: true },
    { label: "2nd reminder", date: formatted[2], state: "pending", editable: true },
    { label: "Final notice", date: formatted[3], state: "pending", editable: true, isFinal: true },
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

function dotClasses(state: DotState, isFinal?: boolean) {
  if (isFinal && state !== "done" && state !== "resolved") {
    return "bg-amber-500 border-amber-500 text-white";
  }
  switch (state) {
    case "done":
    case "resolved":
      return "bg-primary border-primary text-primary-foreground";
    case "active":
      return "bg-primary/15 border-primary text-primary";
    default:
      return "bg-background border-border text-transparent";
  }
}

export default function ChaseTimeline({ invoice }: { invoice: Invoice }) {
  const [editing, setEditing] = useState(false);
  const [customDates, setCustomDates] = useState<Record<number, string>>({});

  const due = new Date(invoice.dueDateISO);
  const safeDue = isNaN(due.getTime()) ? new Date() : due;
  const sentDate = new Date(safeDue);
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
    <div className="mt-5 bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Chase Timeline</h3>
        {hasEditableSteps && !editing && (
          <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-xs text-primary font-medium hover:opacity-80">
            <Edit2 className="w-3 h-3" /> Edit dates
          </button>
        )}
        {editing && (
          <button onClick={() => setEditing(false)} className="flex items-center gap-1 text-xs text-primary font-medium hover:opacity-80">
            <Check className="w-3.5 h-3.5" /> Done
          </button>
        )}
      </div>

      <div className="relative">
        {timeline.map((ev, i) => {
          const isLast = i === timeline.length - 1;
          const isActive = ev.state === "active";
          return (
            <div key={i} className="relative flex items-start gap-3 pb-5 last:pb-0">
              {/* Vertical connector */}
              {!isLast && (
                <span
                  className="absolute left-[11px] top-6 bottom-0 w-px bg-border"
                  aria-hidden="true"
                />
              )}

              {/* Dot */}
              <div
                className={`relative z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${dotClasses(ev.state, ev.isFinal)}`}
              >
                {(ev.state === "done" || ev.state === "resolved") && <Check className="w-3 h-3" strokeWidth={3} />}
                {ev.isFinal && ev.state !== "done" && ev.state !== "resolved" && (
                  <AlertTriangle className="w-3 h-3" strokeWidth={2.5} />
                )}
              </div>

              {/* Label + date */}
              <div
                className={`flex-1 min-w-0 flex items-center justify-between gap-3 -mt-0.5 ${
                  isActive ? "bg-primary/5 -mx-2 px-2 py-1 rounded-lg" : ""
                }`}
              >
                <div className="min-w-0">
                  <p
                    className={`text-sm font-medium leading-tight ${
                      ev.isFinal && ev.state !== "done" ? "text-amber-700 dark:text-amber-500" : "text-foreground"
                    }`}
                  >
                    {ev.label}
                  </p>
                  {isActive && <p className="text-[11px] text-primary font-medium mt-0.5">In progress</p>}
                </div>

                {editing && ev.editable ? (
                  <input
                    type="date"
                    value={customDates[i] ?? rawDates[i]}
                    onChange={(e) => handleDateChange(i, e.target.value)}
                    className="text-xs px-2 py-1 rounded-md border border-primary/30 bg-muted text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />
                ) : (
                  ev.date && <p className="text-xs text-muted-foreground shrink-0">{ev.date}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
