import type { Tone } from "@/components/invoice/DraftTemplates";
import type { SchedulePreset } from "@/lib/scheduleDefaults";

export type WorkType =
  | "designer"
  | "developer"
  | "writer"
  | "consultant"
  | "agency"
  | "other";

export type InvoiceSizeBucket = "<500" | "500-2k" | "2k-10k" | "10k+";

export type ClientLoadBucket = "1-3" | "4-10" | "10+";

export type MirrorBlocker = "dread" | "overthinking" | "avoidance" | "letting_slide";

export type WorstOverdueBucket = "<14" | "14-30" | "30-60" | "60+";

export type UserProfile = {
  workType?: WorkType;
  invoiceSize?: InvoiceSizeBucket;
  clientLoad?: ClientLoadBucket;
  mirrorBlockers?: MirrorBlocker[];
  worstOverdueBucket?: WorstOverdueBucket;
  chaseSchedule?: SchedulePreset;
  tone?: Tone;
  displayName?: string;
};
