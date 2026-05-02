// Single source of truth for invoice status, days-past-due, the chase anchor
// date used by schedule generation, and the lateness-based tone floor.
//
// Why these live together: every place in the app that asks "is this invoice
// overdue?" or "what tone should this step go out with?" should pull from here
// so client display, schedule generation, and the daily reconcile cron stay
// in lockstep.

import { differenceInDays, parseISO } from "date-fns";
import type { Invoice, InvoiceStatus } from "@/lib/data";
import type { ScheduleStep } from "@/lib/scheduleDefaults";

const ESCALATION_THRESHOLD_DAYS = 21;

export type Tone = ScheduleStep["tone"];

const TONE_RANK: Record<Tone, number> = {
  Friendly: 0,
  Firm: 1,
  Urgent: 2,
  "Final Notice": 3,
};

// Highest threshold first — first match wins.
const TONE_FLOOR_BY_DAYS_LATE: Array<{ minDaysLate: number; tone: Tone }> = [
  { minDaysLate: 21, tone: "Final Notice" },
  { minDaysLate: 14, tone: "Urgent" },
  { minDaysLate: 7, tone: "Firm" },
  { minDaysLate: 0, tone: "Friendly" },
];

export function computeInvoiceStatus(invoice: Invoice, today: Date = new Date()): InvoiceStatus {
  if (invoice.status === "Paid") return "Paid";
  const due = parseISO(invoice.dueDateISO);
  const days = differenceInDays(today, due);
  if (days >= ESCALATION_THRESHOLD_DAYS) return "Escalated";
  if (days >= 1) return "Overdue";
  return "Upcoming";
}

export function computeDaysPastDue(invoice: Invoice, today: Date = new Date()): number {
  const due = parseISO(invoice.dueDateISO);
  return Math.max(0, differenceInDays(today, due));
}

// Schedule steps anchor to max(due_date, created_at). For an invoice logged
// after its own due date, this means the chase starts at creation rather than
// firing every step in the past at once.
export function chaseAnchorDate(invoice: { dueDateISO: string; createdAtISO: string }): Date {
  const due = parseISO(invoice.dueDateISO);
  const created = parseISO(invoice.createdAtISO);
  return due.getTime() >= created.getTime() ? due : created;
}

export function toneFloorForDaysLate(daysLate: number): Tone {
  return TONE_FLOOR_BY_DAYS_LATE.find((t) => daysLate >= t.minDaysLate)!.tone;
}

// The preset's tone is honored unless the invoice's actual lateness at fire
// time demands a harsher voice. This only ever escalates upward, so normal
// future-dated invoices behave identically to before.
export function effectiveTone(presetTone: Tone, daysLateAtFireTime: number): Tone {
  const floor = toneFloorForDaysLate(daysLateAtFireTime);
  return TONE_RANK[floor] > TONE_RANK[presetTone] ? floor : presetTone;
}
