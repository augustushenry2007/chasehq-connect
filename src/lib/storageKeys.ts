export const STORAGE_KEYS = {
  OAUTH_IN_PROGRESS: "oauth_in_progress",
  OAUTH_COMPLETED: "oauth_completed",
  ONBOARDING_STATE: "onboarding_state",
  ONBOARDING_DONE_SESSION: "onboarding_done_session",
  SCHEDULE_PRESET: "schedule_preset",
} as const;

export function mailboxPromptShownKey(userId: string | undefined | null): string {
  return `mailbox_prompt_shown_${userId ?? ""}`;
}

export function displayNamePromptShownKey(userId: string | undefined | null): string {
  return `display_name_prompted_${userId ?? ""}`;
}
