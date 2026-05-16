-- §2.3: CHECK constraint enforcing notification state machine invariants.
-- Prevents accidental state regression (e.g. a stray UPDATE setting delivered
-- with no delivered_at, or read with no delivered_at). The 'failed' state was
-- declared in the enum but never written — the new dispatch-notifications
-- retry logic now uses it when MAX_EMAIL_ATTEMPTS is exhausted.
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_status_invariants CHECK (
    (status = 'pending')
    OR (status = 'delivered' AND delivered_at IS NOT NULL)
    OR (status = 'read' AND delivered_at IS NOT NULL AND read_at IS NOT NULL)
    OR (status = 'canceled')
    OR (status = 'failed' AND email_attempts >= 5 AND email_sent_at IS NULL)
  );

-- §2.6: Out-of-order Apple notification protection. Apple's App Store Server
-- Notifications V2 carry a signedDate (ms since epoch) on the outer payload.
-- Without ordering, a delayed DID_FAIL_TO_RENEW arriving after DID_RENEW would
-- regress the subscription to past_due/expired despite a successful renewal.
-- apple-notifications now compares this column before applying any event.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS latest_event_signed_date timestamptz;

-- §2.4: Extend cancellation trigger to also catch delivered-but-unsent rows.
-- The hourly cron's retry pass would otherwise keep trying to email a follow-up
-- for an invoice the user just marked Paid, until the row hits MAX_EMAIL_ATTEMPTS
-- or ages out of RETRY_WINDOW_HOURS. Cancel them immediately so the trigger
-- stays the source of truth for "this invoice is done."
CREATE OR REPLACE FUNCTION public.cancel_notifications_on_invoice_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    UPDATE public.notifications SET status = 'canceled'
      WHERE invoice_id = OLD.id
        AND (status = 'pending' OR (status = 'delivered' AND email_sent_at IS NULL));
    DELETE FROM public.followup_schedules WHERE invoice_id = OLD.id;
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE' AND NEW.status = 'Paid' AND OLD.status <> 'Paid') THEN
    UPDATE public.notifications SET status = 'canceled'
      WHERE invoice_id = NEW.id
        AND (status = 'pending' OR (status = 'delivered' AND email_sent_at IS NULL));
  END IF;
  RETURN NEW;
END;
$$;
