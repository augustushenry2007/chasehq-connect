import type { Tone } from "@/components/invoice/DraftTemplates";
import type { UserProfile, WorkType } from "@/lib/userProfile/types";

export type OpenerMood = "default" | "confident_warm" | "organized" | "soft_direct";
export type CushionLength = "short" | "default" | "long";

export type RegisterTokens = {
  greetingTeam: (client: string) => string;
  greetingPerson: (client: string) => string;
  pronounI: string;
  pronounMy: string;
  pronounMe: string;
  signoffFriendly: string;
  signoffFormal: string;
  openerMood: OpenerMood;
  cushionLength: CushionLength;
  describeWork: (description: string) => string;
};

const FORMAL_WORK_TYPES: WorkType[] = ["agency", "consultant"];
const CASUAL_WORK_TYPES: WorkType[] = ["designer", "developer", "writer"];

function isFormalWorkType(workType?: WorkType): boolean {
  return !!workType && FORMAL_WORK_TYPES.includes(workType);
}

function isCasualWorkType(workType?: WorkType): boolean {
  return !!workType && CASUAL_WORK_TYPES.includes(workType);
}

function pickOpenerMood(profile: UserProfile): OpenerMood {
  const blockers = profile.mirrorBlockers ?? [];
  if (blockers.includes("overthinking")) return "confident_warm";
  if (blockers.includes("letting_slide")) return "organized";
  if (blockers.includes("dread") || blockers.includes("avoidance")) return "soft_direct";
  return "default";
}

function pickCushionLength(profile: UserProfile, tone: Tone): CushionLength {
  if (tone === "Urgent" || tone === "Final Notice") return "default";
  if (profile.invoiceSize === "10k+") return "long";
  if (profile.invoiceSize === "<500" && tone === "Friendly") return "short";
  return "default";
}

function describeWorkForType(workType: WorkType | undefined, fallback: string): string {
  const lower = fallback.toLowerCase();
  // If the description already names the work, leave it. Token only applies when
  // a template wants a generic stand-in noun.
  if (lower) return lower;
  switch (workType) {
    case "designer":   return "design work";
    case "developer":  return "build";
    case "writer":     return "writing";
    case "consultant": return "engagement";
    case "agency":     return "engagement";
    default:           return "work";
  }
}

/**
 * Build register tokens for a given profile + tone. Tone-tier rules override
 * work-type style — Firm/Urgent/Final Notice always go formal regardless of
 * casual work types, because escalation requires register weight.
 */
export function getRegisterTokens(profile: UserProfile, tone: Tone): RegisterTokens {
  const formalTier = tone === "Firm" || tone === "Urgent" || tone === "Final Notice";
  const formalRegister = formalTier || isFormalWorkType(profile.workType);
  const casualRegister = !formalTier && isCasualWorkType(profile.workType);

  // Greetings
  const greetingTeam = (client: string): string => {
    if (formalRegister) return `Dear ${client} team,`;
    if (casualRegister) return `Hi ${client} team,`;
    return `Hello ${client} team,`;
  };
  const greetingPerson = (client: string): string => {
    if (formalRegister) return `Dear ${client},`;
    if (casualRegister) return `Hi ${client},`;
    return `Hello ${client},`;
  };

  // Pronouns — agencies and high client load use "we"; otherwise "I"
  const usesWe =
    profile.workType === "agency" ||
    (profile.clientLoad === "10+" && profile.workType !== "designer" && profile.workType !== "writer");
  const pronounI = usesWe ? "We" : "I";
  const pronounMy = usesWe ? "our" : "my";
  const pronounMe = usesWe ? "us" : "me";

  // Sign-offs
  const signoffFormal = "Regards";
  let signoffFriendly: string;
  if (formalRegister) signoffFriendly = "Best regards";
  else if (profile.workType === "agency" || profile.workType === "consultant") signoffFriendly = "Best";
  else if (casualRegister) signoffFriendly = "Cheers";
  else signoffFriendly = "Thanks";

  return {
    greetingTeam,
    greetingPerson,
    pronounI,
    pronounMy,
    pronounMe,
    signoffFriendly,
    signoffFormal,
    openerMood: pickOpenerMood(profile),
    cushionLength: pickCushionLength(profile, tone),
    describeWork: (description: string) => describeWorkForType(profile.workType, description),
  };
}

/**
 * Default tokens for legacy users (no profile collected yet). Mirrors the
 * pre-personalization behavior of DraftTemplates so existing accounts see no
 * regression until they backfill a profile.
 */
export function getDefaultRegisterTokens(tone: Tone): RegisterTokens {
  return getRegisterTokens({}, tone);
}
