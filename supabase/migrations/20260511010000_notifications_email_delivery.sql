-- §1: decouple in-app notification delivery from the Resend email send.
--
-- The dispatcher flips a notification row to `delivered` the moment the in-app
-- reminder fires, but the follow-up *email* is a separate channel that can fail
-- (Resend 4xx/5xx, transport error). Track its outcome separately so a failed
-- email can be retried without re-delivering the in-app notification.
--
--   email_sent_at  NULL until the Resend email actually succeeds (also stays NULL
--                  for rows where no email applies — e.g. user has email disabled).
--   email_attempts count of failed Resend attempts; the dispatcher retries while
--                  this is < 5, then the row is dead-lettered (surfaced in logs).

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS email_sent_at  timestamptz,
  ADD COLUMN IF NOT EXISTS email_attempts smallint NOT NULL DEFAULT 0;

-- Partial index for the dispatcher's email-retry selection:
--   status = 'delivered' AND email_sent_at IS NULL AND email_attempts < 5
CREATE INDEX IF NOT EXISTS idx_notifications_email_retry
  ON public.notifications (scheduled_for)
  WHERE status = 'delivered' AND email_sent_at IS NULL;
