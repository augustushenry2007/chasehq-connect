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

CREATE POLICY "users read own send log"
  ON public.email_send_log FOR SELECT
  USING (auth.uid() = user_id);
