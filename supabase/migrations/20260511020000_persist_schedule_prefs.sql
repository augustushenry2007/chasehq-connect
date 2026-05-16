-- §4: persist the follow-up-schedule preferences server-side.
--
-- The chosen preset, any custom step list, and the default follow-up tone all
-- lived in localStorage only — so a reinstall / sign-in on a new device silently
-- threw away the user's carefully-tuned cadence and every new invoice started
-- chasing on the wrong schedule. Mirror them onto notification_preferences so
-- they follow the account. (Nullable: NULL means "not set / fall back to the
-- onboarding-derived default", matching the pre-migration behaviour.)

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS schedule_preset text,
  ADD COLUMN IF NOT EXISTS schedule_steps  jsonb,
  ADD COLUMN IF NOT EXISTS default_tone    text;

-- Existing RLS UPDATE/INSERT policies already scope to auth.uid() = user_id, so
-- the client can write these columns through the normal notification_preferences
-- upsert path — no new policy needed.
