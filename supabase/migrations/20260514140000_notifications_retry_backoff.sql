-- Exponential backoff for the email-retry pass. Today the retry loop in
-- dispatch-notifications attempts every cron tick (hourly) until
-- email_attempts >= 5, which means a transient Resend outage burns all
-- 5 attempts in the first 5 hours and the email is dead-lettered well before
-- Resend recovers. Stamping last_email_attempt_at lets the dispatcher gate on
-- elapsed time per row (1, 2, 4, 8, 16 minutes between attempts).
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS last_email_attempt_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_notifications_email_retry
  ON public.notifications (last_email_attempt_at)
  WHERE status = 'delivered' AND email_sent_at IS NULL;
