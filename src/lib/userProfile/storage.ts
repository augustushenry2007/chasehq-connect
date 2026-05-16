import { STORAGE_KEYS } from "@/lib/storageKeys";
import type {
  UserProfile,
  WorkType,
  InvoiceSizeBucket,
  ClientLoadBucket,
  MirrorBlocker,
  WorstOverdueBucket,
} from "./types";
import type { SchedulePreset } from "@/lib/scheduleDefaults";

function isDemoMode(): boolean {
  return typeof localStorage !== "undefined" && localStorage.getItem("chasehq_demo_mode") === "1";
}

// Fallback values for fresh demo sessions (before onboarding completes). Mirrors
// the previously-hardcoded demoUserProfile in AppProviderDemo.
const DEMO_FALLBACKS = {
  workType: "designer" as WorkType,
  invoiceSize: "500-2k" as InvoiceSizeBucket,
  clientLoad: "4-10" as ClientLoadBucket,
  mirrorBlockers: ["overthinking"] as MirrorBlocker[],
  worstOverdueBucket: "14-30" as WorstOverdueBucket,
  chaseSchedule: "patient" as SchedulePreset,
};

const VALID_WORK_TYPES: WorkType[] = ["designer", "developer", "writer", "consultant", "agency", "other"];
const VALID_INVOICE_SIZES: InvoiceSizeBucket[] = ["<500", "500-2k", "2k-10k", "10k+"];
const VALID_CLIENT_LOADS: ClientLoadBucket[] = ["1-3", "4-10", "10+"];
const VALID_MIRROR_BLOCKERS: MirrorBlocker[] = ["dread", "overthinking", "avoidance", "letting_slide"];
const VALID_WORST_OVERDUE: WorstOverdueBucket[] = ["<14", "14-30", "30-60", "60+"];

function readEnum<T extends string>(key: string, valid: T[]): T | undefined {
  const v = localStorage.getItem(key);
  return v && (valid as string[]).includes(v) ? (v as T) : undefined;
}

function readMirrorBlockersFromKey(key: string): MirrorBlocker[] | undefined {
  const raw = localStorage.getItem(key);
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return undefined;
    const filtered = parsed.filter((x): x is MirrorBlocker =>
      typeof x === "string" && (VALID_MIRROR_BLOCKERS as string[]).includes(x),
    );
    return filtered.length ? filtered : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Reads the localStorage-backed slice of UserProfile. Does not include
 * displayName or tone — those come from AppContext (fullName, notifications)
 * and are stitched in at the call site.
 *
 * In demo mode, reads from demo-namespaced keys with DEMO_FALLBACKS so that
 * demo onboarding choices are reflected without touching real-app keys.
 */
export function readLocalUserProfile(): Pick<
  UserProfile,
  "workType" | "invoiceSize" | "clientLoad" | "mirrorBlockers" | "worstOverdueBucket" | "chaseSchedule"
> {
  const demo = isDemoMode();
  if (demo) {
    return {
      workType: readEnum<WorkType>(STORAGE_KEYS.DEMO_USER_PROFILE_WORK_TYPE, VALID_WORK_TYPES) ?? DEMO_FALLBACKS.workType,
      invoiceSize: readEnum<InvoiceSizeBucket>(STORAGE_KEYS.DEMO_USER_PROFILE_INVOICE_SIZE, VALID_INVOICE_SIZES) ?? DEMO_FALLBACKS.invoiceSize,
      clientLoad: readEnum<ClientLoadBucket>(STORAGE_KEYS.DEMO_USER_PROFILE_CLIENT_LOAD, VALID_CLIENT_LOADS) ?? DEMO_FALLBACKS.clientLoad,
      mirrorBlockers: readMirrorBlockersFromKey(STORAGE_KEYS.DEMO_USER_PROFILE_MIRROR_BLOCKERS) ?? DEMO_FALLBACKS.mirrorBlockers,
      worstOverdueBucket: readEnum<WorstOverdueBucket>(STORAGE_KEYS.DEMO_USER_PROFILE_WORST_OVERDUE, VALID_WORST_OVERDUE) ?? DEMO_FALLBACKS.worstOverdueBucket,
      chaseSchedule: (localStorage.getItem(STORAGE_KEYS.DEMO_SCHEDULE_PRESET) as SchedulePreset | null) ?? DEMO_FALLBACKS.chaseSchedule,
    };
  }
  return {
    workType: readEnum<WorkType>(STORAGE_KEYS.USER_PROFILE_WORK_TYPE, VALID_WORK_TYPES),
    invoiceSize: readEnum<InvoiceSizeBucket>(STORAGE_KEYS.USER_PROFILE_INVOICE_SIZE, VALID_INVOICE_SIZES),
    clientLoad: readEnum<ClientLoadBucket>(STORAGE_KEYS.USER_PROFILE_CLIENT_LOAD, VALID_CLIENT_LOADS),
    mirrorBlockers: readMirrorBlockersFromKey(STORAGE_KEYS.USER_PROFILE_MIRROR_BLOCKERS),
    worstOverdueBucket: readEnum<WorstOverdueBucket>(STORAGE_KEYS.USER_PROFILE_WORST_OVERDUE, VALID_WORST_OVERDUE),
    chaseSchedule: (localStorage.getItem(STORAGE_KEYS.SCHEDULE_PRESET) as SchedulePreset | null) ?? undefined,
  };
}

// Write functions route to demo-namespaced keys when in demo mode so that
// onboarding choices never contaminate real-mode profile state.

export function writeWorkType(v: WorkType): void {
  localStorage.setItem(isDemoMode() ? STORAGE_KEYS.DEMO_USER_PROFILE_WORK_TYPE : STORAGE_KEYS.USER_PROFILE_WORK_TYPE, v);
}

export function writeInvoiceSize(v: InvoiceSizeBucket): void {
  localStorage.setItem(isDemoMode() ? STORAGE_KEYS.DEMO_USER_PROFILE_INVOICE_SIZE : STORAGE_KEYS.USER_PROFILE_INVOICE_SIZE, v);
}

export function writeClientLoad(v: ClientLoadBucket): void {
  localStorage.setItem(isDemoMode() ? STORAGE_KEYS.DEMO_USER_PROFILE_CLIENT_LOAD : STORAGE_KEYS.USER_PROFILE_CLIENT_LOAD, v);
}

export function writeMirrorBlockers(v: MirrorBlocker[]): void {
  localStorage.setItem(isDemoMode() ? STORAGE_KEYS.DEMO_USER_PROFILE_MIRROR_BLOCKERS : STORAGE_KEYS.USER_PROFILE_MIRROR_BLOCKERS, JSON.stringify(v));
}

export function writeWorstOverdueBucket(v: WorstOverdueBucket): void {
  localStorage.setItem(isDemoMode() ? STORAGE_KEYS.DEMO_USER_PROFILE_WORST_OVERDUE : STORAGE_KEYS.USER_PROFILE_WORST_OVERDUE, v);
}

export function writeChaseSchedule(v: SchedulePreset): void {
  localStorage.setItem(isDemoMode() ? STORAGE_KEYS.DEMO_SCHEDULE_PRESET : STORAGE_KEYS.SCHEDULE_PRESET, v);
}

export function writeRecommendedSchedule(v: SchedulePreset): void {
  localStorage.setItem(STORAGE_KEYS.USER_PROFILE_RECOMMENDED_SCHEDULE, v);
}

export function writeDidOverrideSchedule(v: boolean): void {
  localStorage.setItem(STORAGE_KEYS.USER_PROFILE_DID_OVERRIDE_SCHEDULE, v ? "1" : "0");
}

export function clearLocalUserProfile(): void {
  localStorage.removeItem(STORAGE_KEYS.USER_PROFILE_WORK_TYPE);
  localStorage.removeItem(STORAGE_KEYS.USER_PROFILE_INVOICE_SIZE);
  localStorage.removeItem(STORAGE_KEYS.USER_PROFILE_CLIENT_LOAD);
  localStorage.removeItem(STORAGE_KEYS.USER_PROFILE_MIRROR_BLOCKERS);
  localStorage.removeItem(STORAGE_KEYS.USER_PROFILE_WORST_OVERDUE);
  localStorage.removeItem(STORAGE_KEYS.USER_PROFILE_RECOMMENDED_SCHEDULE);
  localStorage.removeItem(STORAGE_KEYS.USER_PROFILE_DID_OVERRIDE_SCHEDULE);
}

export function clearDemoUserProfile(): void {
  localStorage.removeItem(STORAGE_KEYS.DEMO_USER_PROFILE_WORK_TYPE);
  localStorage.removeItem(STORAGE_KEYS.DEMO_USER_PROFILE_INVOICE_SIZE);
  localStorage.removeItem(STORAGE_KEYS.DEMO_USER_PROFILE_CLIENT_LOAD);
  localStorage.removeItem(STORAGE_KEYS.DEMO_USER_PROFILE_MIRROR_BLOCKERS);
  localStorage.removeItem(STORAGE_KEYS.DEMO_USER_PROFILE_WORST_OVERDUE);
  localStorage.removeItem(STORAGE_KEYS.DEMO_SCHEDULE_PRESET);
}

// Per-user profile cache — keyed by user ID so returning sign-ins skip the
// profile DB round-trip and dismiss the splash synchronously.
const PROFILE_CACHE_PREFIX = "chasehq_profile_cache_v1:";

export interface CachedProfile {
  onboarding_completed: boolean;
  tour_completed: boolean;
  full_name: string | null;
}

export function readProfileCache(userId: string): CachedProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_PREFIX + userId);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.onboarding_completed !== "boolean") return null;
    return {
      onboarding_completed: !!parsed.onboarding_completed,
      tour_completed: !!parsed.tour_completed,
      full_name: typeof parsed.full_name === "string" ? parsed.full_name : null,
    };
  } catch { return null; }
}

export function writeProfileCache(userId: string, p: CachedProfile): void {
  try {
    localStorage.setItem(PROFILE_CACHE_PREFIX + userId, JSON.stringify(p));
  } catch (e) {
    console.warn("[profileCache] write failed", e);
  }
}

export function clearProfileCache(userId?: string): void {
  if (userId) { localStorage.removeItem(PROFILE_CACHE_PREFIX + userId); return; }
  Object.keys(localStorage)
    .filter(k => k.startsWith(PROFILE_CACHE_PREFIX))
    .forEach(k => localStorage.removeItem(k));
}
