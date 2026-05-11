-- §1 follow-up: backfill email_sent_at for notifications that were already
-- delivered before 20260511010000 added the column. Pre-migration the dispatcher
-- attempted the Resend email synchronously inside the same tick it marked a row
-- delivered, so for those rows "delivered" implies the email was attempted —
-- treat it as sent. Without this, the new email-retry pass would see every
-- recently-delivered row with email_sent_at = NULL and re-send a duplicate email.

UPDATE public.notifications
SET email_sent_at = COALESCE(delivered_at, updated_at, created_at)
WHERE status = 'delivered' AND email_sent_at IS NULL;
