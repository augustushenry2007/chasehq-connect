-- §A: ensure public.email_send_log actually exists on every environment.
--
-- 20260418115442 created this table with CREATE TABLE IF NOT EXISTS, and the
-- migration history records it as synced — but the table is absent on the
-- remote DB (proven when 20260511030000's `DELETE FROM public.email_send_log`
-- errored `relation "public.email_send_log" does not exist`; that migration's
-- to_regclass guard then silently skipped adding the cascade FK). Classic
-- migration/schema drift. Consequences while it's missing:
--   * send-email gates the promised "1 free send" on a COUNT over this table;
--     the read errors → fail-closed → a trial-expired user with no RevenueCat
--     entitlement is told `subscription_required` instead of getting their send.
--   * the post-send insert into this table fails silently → the free-send tally
--     is never recorded and the delivery record is lost.
--   * delete-account's `delete from email_send_log` is a no-op, and the cascade
--     FK to auth.users was never added → orphaned rows if/when the table appears.
--
-- This migration is fully idempotent: a no-op where the table already exists,
-- a clean recreate (matching 20260418115442 byte-for-byte on the table/index/
-- policy, plus the cascade FK that 20260511030000 meant to add) where it doesn't.

CREATE TABLE IF NOT EXISTS public.email_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  recipient text NOT NULL,
  invoice_id uuid,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_send_log_user_sent
  ON public.email_send_log (user_id, sent_at DESC);

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'email_send_log'
      AND policyname = 'users read own send log'
  ) THEN
    CREATE POLICY "users read own send log"
      ON public.email_send_log FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  -- Cascade FK to auth.users (the one 20260511030000 skipped). Sweep any
  -- pre-existing orphans first so ADD CONSTRAINT doesn't 23503 on old data.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_email_send_log_user') THEN
    DELETE FROM public.email_send_log WHERE user_id NOT IN (SELECT id FROM auth.users);
    ALTER TABLE public.email_send_log
      ADD CONSTRAINT fk_email_send_log_user
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;
