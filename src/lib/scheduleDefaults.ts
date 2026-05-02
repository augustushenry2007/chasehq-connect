// Default follow-up cadence: due date + 3, 7, 14 days.
// Each step generates one notification scheduled at 9:00 local time.

import { STORAGE_KEYS } from "@/lib/storageKeys";

export type ScheduleStep = {
  offset_days: number;
  tone: "Friendly" | "Firm" | "Urgent" | "Final Notice";
  type: "due" | "followup" | "escalation";
  status: "pending" | "sent" | "skipped";
};

export type SchedulePreset = "patient" | "light" | "active";

export const PRESET_STEPS: Record<SchedulePreset, ScheduleStep[]> = {
  active: [
    { offset_days: 3,  tone: "Friendly",     type: "followup",   status: "pending" },
    { offset_days: 7,  tone: "Firm",         type: "followup",   status: "pending" },
    { offset_days: 14, tone: "Urgent",       type: "escalation", status: "pending" },
    { offset_days: 21, tone: "Final Notice", type: "escalation", status: "pending" },
  ],
  patient: [
    { offset_days: 5,  tone: "Friendly",     type: "followup",   status: "pending" },
    { offset_days: 13, tone: "Friendly",     type: "followup",   status: "pending" },
    { offset_days: 20, tone: "Firm",         type: "followup",   status: "pending" },
    { offset_days: 23, tone: "Final Notice", type: "escalation", status: "pending" },
  ],
  light: [
    { offset_days: 7,  tone: "Friendly", type: "followup", status: "pending" },
    { offset_days: 14, tone: "Friendly", type: "followup", status: "pending" },
    { offset_days: 21, tone: "Firm",     type: "followup", status: "pending" },
    { offset_days: 28, tone: "Firm",     type: "followup", status: "pending" },
  ],
};

export const DEFAULT_STEPS = PRESET_STEPS.active;

export function getDefaultSteps(): ScheduleStep[] {
  const preset = (localStorage.getItem(STORAGE_KEYS.SCHEDULE_PRESET) ?? "active") as SchedulePreset;
  return PRESET_STEPS[preset] ?? PRESET_STEPS.active;
}

export function getDefaultStepsForInvoice(): ScheduleStep[] {
  const custom = localStorage.getItem(STORAGE_KEYS.SCHEDULE_CUSTOM_STEPS);
  if (custom) {
    try {
      const parsed = JSON.parse(custom);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch {}
  }
  const preset = (localStorage.getItem(STORAGE_KEYS.SCHEDULE_PRESET) ?? "active") as SchedulePreset;
  return PRESET_STEPS[preset].map((s) => ({ ...s }));
}

export function getDefaultScheduleForInvoice(dueDateISO: string, nowISO: string): ScheduleStep[] {
  const dueMs = new Date(`${dueDateISO.slice(0, 10)}T09:00:00`).getTime();
  const nowMs = new Date(nowISO).getTime();
  const daysLate = Math.max(0, Math.floor((nowMs - dueMs) / 86_400_000));

  if (daysLate === 0) return getDefaultStepsForInvoice();

  if (daysLate <= 6) {
    const base = getDefaultStepsForInvoice();
    const future = base.filter((s) => s.offset_days > daysLate);
    if (future.length) return future.map((s) => ({ ...s }));
  }

  const startTone: ScheduleStep["tone"] =
    daysLate >= 21 ? "Final Notice" :
    daysLate >= 14 ? "Urgent" :
                     "Firm";
  const ladder: ScheduleStep["tone"][] = ["Firm", "Urgent", "Final Notice"];
  let toneIdx = ladder.indexOf(startTone);
  let offset = daysLate + 1;
  const steps: ScheduleStep[] = [];
  while (toneIdx < ladder.length) {
    const tone = ladder[toneIdx];
    steps.push({ offset_days: offset, tone, type: tone === "Final Notice" || tone === "Urgent" ? "escalation" : "followup", status: "pending" });
    if (tone === "Final Notice") break;
    offset += 7;
    toneIdx++;
  }
  return steps;
}

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

/**
 * Schedule generation primitive: given a base step from a preset, produce the
 * actual `scheduled_for` and the effective tone for an invoice. Anchors the
 * fire time to max(due_date, created_at) so back-dated invoices don't try to
 * fire in the past, then escalates the preset tone to the lateness floor at
 * fire time. Future-dated invoices behave identically to the old code path
 * because the anchor equals due_date and the lateness floor is ≤ preset tone.
 */
export function computeStepWithEscalation(
  invoice: { dueDateISO: string; createdAtISO: string },
  presetStep: ScheduleStep,
): { scheduledFor: string; effectiveTone: ScheduleStep["tone"]; daysLateAtFire: number } {
  // Inline the anchor/tone-floor logic to avoid a circular dependency between
  // scheduleDefaults and invoiceStatus (the cron migration mirrors the same
  // thresholds in SQL — keep them in sync).
  const dueMs = new Date(`${invoice.dueDateISO.slice(0, 10)}T09:00:00`).getTime();
  const createdMs = new Date(invoice.createdAtISO).getTime();
  const anchorMs = isNaN(dueMs) || isNaN(createdMs) ? Date.now() : Math.max(dueMs, createdMs);
  const anchorISO = new Date(anchorMs).toISOString().slice(0, 10);
  const scheduledFor = computeStepDate(anchorISO, presetStep.offset_days);

  const fireDate = new Date(scheduledFor);
  const dueDate = new Date(`${invoice.dueDateISO.slice(0, 10)}T09:00:00`);
  const daysLateAtFire = Math.floor((fireDate.getTime() - dueDate.getTime()) / 86_400_000);

  const TONE_RANK: Record<ScheduleStep["tone"], number> = {
    Friendly: 0, Firm: 1, Urgent: 2, "Final Notice": 3,
  };
  const floor: ScheduleStep["tone"] =
    daysLateAtFire >= 21 ? "Final Notice" :
    daysLateAtFire >= 14 ? "Urgent" :
    daysLateAtFire >= 7  ? "Firm" :
                           "Friendly";
  const effectiveTone =
    TONE_RANK[floor] > TONE_RANK[presetStep.tone] ? floor : presetStep.tone;

  return { scheduledFor, effectiveTone, daysLateAtFire };
}

/**
 * Build a schedule step list based on how overdue the invoice is today.
 * Guarantees at most one Final Notice, and starting tone matches actual lateness.
 *
 * offset_days is always relative to due_date (same convention as PRESET_STEPS).
 */
export function buildScheduleForLateness(
  dueDateISO: string,
  nowISO: string,
  preset: SchedulePreset,
): ScheduleStep[] {
  const dueMs = new Date(`${dueDateISO.slice(0, 10)}T09:00:00`).getTime();
  const nowMs = new Date(nowISO).getTime();
  const daysLate = Math.max(0, Math.floor((nowMs - dueMs) / 86_400_000));

  // Bucket 1: on-time — preset as-is.
  if (daysLate === 0) return PRESET_STEPS[preset].map((s) => ({ ...s }));

  // Bucket 2: mildly late (1-6 days) — preset minus steps already in the past.
  if (daysLate <= 6) {
    const future = PRESET_STEPS[preset].filter((s) => s.offset_days > daysLate);
    if (future.length) return future.map((s) => ({ ...s }));
    // All preset steps already past — fall through to bespoke ladder.
  }

  // Buckets 3-5: bespoke ladder anchored at today+1.
  // offset_days = daysLate + 1 puts the first step tomorrow.
  const startTone: ScheduleStep["tone"] =
    daysLate >= 21 ? "Final Notice" :
    daysLate >= 14 ? "Urgent" :
                     "Firm";

  const ladder: ScheduleStep["tone"][] = ["Firm", "Urgent", "Final Notice"];
  let toneIdx = ladder.indexOf(startTone);
  let offset = daysLate + 1;
  const steps: ScheduleStep[] = [];

  while (toneIdx < ladder.length) {
    const tone = ladder[toneIdx];
    steps.push({
      offset_days: offset,
      tone,
      type: tone === "Final Notice" || tone === "Urgent" ? "escalation" : "followup",
      status: "pending",
    });
    if (tone === "Final Notice") break;
    offset += 7;
    toneIdx++;
  }
  return steps;
}

export function getStartingTone(dueDateISO: string, nowISO = new Date().toISOString()): ScheduleStep["tone"] {
  const preset = (localStorage.getItem(STORAGE_KEYS.SCHEDULE_PRESET) ?? "active") as SchedulePreset;
  const steps = buildScheduleForLateness(dueDateISO, nowISO, preset);
  return steps[0]?.tone ?? "Friendly";
}

export function buildNotificationTitle(type: ScheduleStep["type"], client: string, amount: number, tone?: ScheduleStep["tone"]): string {
  const formatted = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
  if (type === "due") return `Payment due today — ${client} (${formatted})`;
  if (type === "escalation") return `Overdue — consider a firmer follow-up to ${client}`;
  return tone ? `${client}: ${tone} reminder` : `Follow up with ${client}`;
}

export function buildNotificationBody(type: ScheduleStep["type"], client: string): string {
  if (type === "due") return `Send a friendly reminder to ${client} now.`;
  if (type === "escalation") return `Earlier reminders went unanswered. A final notice may be appropriate.`;
  return `Keep momentum on this invoice with a quick nudge.`;
}
