export const STORAGE_KEYS = {
  ONBOARDING_STATE: "onboarding_state",
  ONBOARDING_DONE_SESSION: "onboarding_done_session",
  SCHEDULE_PRESET: "schedule_preset",
  SCHEDULE_CUSTOM_STEPS: "schedule_custom_steps",
  USER_PROFILE_WORK_TYPE: "user_profile_work_type",
  USER_PROFILE_INVOICE_SIZE: "user_profile_invoice_size",
  USER_PROFILE_CLIENT_LOAD: "user_profile_client_load",
  USER_PROFILE_MIRROR_BLOCKERS: "user_profile_mirror_blockers",
  USER_PROFILE_WORST_OVERDUE: "user_profile_worst_overdue",
  USER_PROFILE_RECOMMENDED_SCHEDULE: "user_profile_recommended_schedule",
  USER_PROFILE_DID_OVERRIDE_SCHEDULE: "user_profile_did_override_schedule",
  EARLY_MIRROR_SELECTIONS: "chasehq_early_mirror_sel",
  // Demo-mode isolated keys — never read by the real app, never contaminate real profile state
  DEMO_USER_PROFILE_WORK_TYPE: "demo_user_profile_work_type",
  DEMO_USER_PROFILE_INVOICE_SIZE: "demo_user_profile_invoice_size",
  DEMO_USER_PROFILE_CLIENT_LOAD: "demo_user_profile_client_load",
  DEMO_USER_PROFILE_MIRROR_BLOCKERS: "demo_user_profile_mirror_blockers",
  DEMO_USER_PROFILE_WORST_OVERDUE: "demo_user_profile_worst_overdue",
  DEMO_SCHEDULE_PRESET: "demo_schedule_preset",
} as const;

export function displayNamePromptShownKey(userId: string | undefined | null): string {
  return `display_name_prompted_${userId ?? ""}`;
}
