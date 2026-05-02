export const STORAGE_KEYS = {
  OAUTH_IN_PROGRESS: "oauth_in_progress",
  OAUTH_COMPLETED: "oauth_completed",
  ONBOARDING_STATE: "onboarding_state",
  ONBOARDING_DONE_SESSION: "onboarding_done_session",
  SCHEDULE_PRESET: "schedule_preset",
  SCHEDULE_CUSTOM_STEPS: "schedule_custom_steps",
  SIGN_IN_INTENT: "sign_in_intent",
  SEND_AFTER_AUTH: "send_after_auth",
  NO_ACCOUNT_DETECTED: "no_account_detected",
} as const;

export function mailboxPromptShownKey(userId: string | undefined | null): string {
  return `mailbox_prompt_shown_${userId ?? ""}`;
}

export function displayNamePromptShownKey(userId: string | undefined | null): string {
  return `display_name_prompted_${userId ?? ""}`;
}
