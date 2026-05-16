-- Two pieces that ship together for the deliverability audit (task 1.1 + 1.2):
-- 1. email_suppressions: recipients we've stopped emailing (unsubscribe, hard
--    bounce, complaint). All send paths consult this before contacting Resend.
-- 2. email_send_log: add resend_message_id + delivery_status + bounce_reason so
--    the Resend webhook can correlate bounce/complaint events back to the send
--    that produced them.

-- ── email_suppressions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.email_suppressions (
  recipient text PRIMARY KEY,
  -- user_id is optional: unsubscribes are global (one recipient should never
  -- get mail again, regardless of which sender triggered it), but we record the
  -- user_id that *caused* the suppression for audit/UX (e.g. "X recipients
  -- unsubscribed from your sends").
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text NOT NULL,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_suppressions_user
  ON public.email_suppressions (user_id);

ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;

-- No client reads or writes. Only service_role (edge functions) touches this
-- table — there's no UX where a freelancer needs to enumerate other people's
-- email addresses. Service role bypasses RLS by default; no explicit policies
-- needed.

-- ── email_send_log additions ──────────────────────────────────────────────────
ALTER TABLE public.email_send_log
  ADD COLUMN IF NOT EXISTS resend_message_id text,
  ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'queued',
  ADD COLUMN IF NOT EXISTS bounce_reason text;

-- Unique constraint on resend_message_id so webhook upserts can land idempotently.
-- Partial index: rows from before this change have NULL message_id and shouldn't
-- block each other.
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_send_log_resend_message_id
  ON public.email_send_log (resend_message_id)
  WHERE resend_message_id IS NOT NULL;
