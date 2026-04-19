// Default follow-up cadence: due date + 3, 7, 14 days.
// Each step generates one notification scheduled at 9:00 local time.

export type ScheduleStep = {
  offset_days: number;
  tone: "Friendly" | "Firm" | "Final Notice";
  type: "due" | "followup" | "escalation";
  status: "pending" | "sent" | "skipped";
};

export const DEFAULT_STEPS: ScheduleStep[] = [
  { offset_days: 0, tone: "Friendly", type: "due", status: "pending" },
  { offset_days: 3, tone: "Friendly", type: "followup", status: "pending" },
  { offset_days: 7, tone: "Firm", type: "followup", status: "pending" },
  { offset_days: 14, tone: "Final Notice", type: "escalation", status: "pending" },
];

export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * Compute the UTC ISO timestamp for a step, anchored at 9am in the user's timezone
 * on (dueDate + offset_days).
 */
export function computeStepDate(dueDateISO: string, offsetDays: number): string {
  // Accept either YYYY-MM-DD or a full ISO string. Fall back to today if unparseable
  // so callers never throw a RangeError on .toISOString().
  const ymd = (dueDateISO || "").slice(0, 10);
  let base = new Date(`${ymd}T09:00:00`);
  if (isNaN(base.getTime())) {
    const fallback = new Date();
    fallback.setHours(9, 0, 0, 0);
    base = fallback;
  }
  base.setDate(base.getDate() + offsetDays);
  return base.toISOString();
}

export function buildNotificationTitle(type: ScheduleStep["type"], client: string, amount: number): string {
  const formatted = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
  if (type === "due") return `Payment due today — ${client} (${formatted})`;
  if (type === "escalation") return `Overdue — consider a firmer follow-up to ${client}`;
  return `Time to follow up with ${client}`;
}

export function buildNotificationBody(type: ScheduleStep["type"], client: string): string {
  if (type === "due") return `Send a friendly reminder to ${client} now.`;
  if (type === "escalation") return `Earlier reminders went unanswered. A final notice may be appropriate.`;
  return `Keep momentum on this invoice with a quick nudge.`;
}
