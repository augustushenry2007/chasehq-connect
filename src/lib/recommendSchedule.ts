import type { SchedulePreset } from "@/lib/scheduleDefaults";
import type { UserProfile } from "@/lib/userProfile/types";

export type ScheduleRecommendation = {
  preset: SchedulePreset;
  score: number;
  topReasons: Array<"avoidance" | "letting_slide" | "overthinking" | "dread" | "worstOverdue" | "invoiceSize" | "clientLoad" | "agency">;
};

export function recommendSchedule(profile: UserProfile): ScheduleRecommendation {
  let score = 0;
  const contributions: Array<{ key: ScheduleRecommendation["topReasons"][number]; weight: number }> = [];

  if (profile.mirrorBlockers?.includes("avoidance")) {
    score += 2;
    contributions.push({ key: "avoidance", weight: 2 });
  }
  if (profile.mirrorBlockers?.includes("letting_slide")) {
    score += 2;
    contributions.push({ key: "letting_slide", weight: 2 });
  }
  if (profile.mirrorBlockers?.includes("dread")) {
    score += 1;
    contributions.push({ key: "dread", weight: 1 });
  }

  switch (profile.worstOverdueBucket) {
    case "<14":   break;
    case "14-30": score += 1; contributions.push({ key: "worstOverdue", weight: 1 }); break;
    case "30-60": score += 2; contributions.push({ key: "worstOverdue", weight: 2 }); break;
    case "60+":   score += 3; contributions.push({ key: "worstOverdue", weight: 3 }); break;
  }

  switch (profile.invoiceSize) {
    case "<500":   break;
    case "500-2k": score += 1; contributions.push({ key: "invoiceSize", weight: 1 }); break;
    case "2k-10k": score += 2; contributions.push({ key: "invoiceSize", weight: 2 }); break;
    case "10k+":   score += 2; contributions.push({ key: "invoiceSize", weight: 2 }); break;
  }

  switch (profile.clientLoad) {
    case "1-3":  score -= 1; contributions.push({ key: "clientLoad", weight: -1 }); break;
    case "4-10": break;
    case "10+":  score += 2; contributions.push({ key: "clientLoad", weight: 2 }); break;
  }

  if (profile.workType === "agency") {
    score += 1;
    contributions.push({ key: "agency", weight: 1 });
  }

  // active = fastest cadence (3/7/14/21 days)
  // patient = medium cadence (5/13/20/23 days)  ← "Standard" in UI
  // light = slowest cadence (7/14/21/28 days)   ← "Relaxed" in UI
  let preset: SchedulePreset;
  if (score <= 2) preset = "light";
  else if (score <= 5) preset = "patient";
  else preset = "active";

  const topReasons = contributions
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
    .slice(0, 2)
    .map((c) => c.key);

  return { preset, score, topReasons };
}

export function recommendationReasonLine(
  recommendation: ScheduleRecommendation,
  profile: UserProfile,
): string {
  const [primary] = recommendation.topReasons;
  if (!primary) {
    return "Recommended as a balanced starting point — adjust anytime.";
  }
  const isActive = recommendation.preset === "active";
  const isLight = recommendation.preset === "light";

  switch (primary) {
    case "avoidance":
      return "Recommended because following up manually is the part you put off — we'll handle it on a steady cadence.";
    case "letting_slide":
      return "Recommended because invoices have slipped before — a tighter cadence keeps them from disappearing.";
    case "dread":
      return isLight
        ? "Recommended because a gentler cadence still gets the message across without the dread."
        : "Recommended to take the awkward part off your plate, on a steady rhythm.";
    case "overthinking":
      return "Recommended because you sometimes overthink the message — three measured reminders take that off your plate.";
    case "worstOverdue":
      if (profile.worstOverdueBucket === "60+") return "Recommended because you've waited 60+ days before — tight cadence helps prevent that pattern.";
      if (profile.worstOverdueBucket === "30-60") return "Recommended because chronic 30–60 day waits suggest a more active follow-up rhythm.";
      return "Recommended based on how long you've waited on past payments.";
    case "invoiceSize":
      if (profile.invoiceSize === "10k+") return "Recommended because larger invoices warrant tighter follow-up to keep cashflow predictable.";
      return "Recommended because invoices in your range respond well to a steady follow-up rhythm.";
    case "clientLoad":
      if (isLight) return "Recommended because with a small client list, relationships matter more than aggressive cadence.";
      if (isActive) return "Recommended because following up at scale is exactly what we'll automate for you.";
      return "Recommended for your client volume.";
    case "agency":
      return "Recommended for agencies — keeps engagement records current without manual chasing.";
  }
}
