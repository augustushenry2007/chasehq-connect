-- §E: heartbeat + auto-retry for the hourly notification dispatcher.
--
-- 20260503000006 schedules dispatch-notifications via net.http_post with no
-- awaiting of the response, no retry, and no record of whether it ran. pg_net
-- delivers the response asynchronously and never retries — so if the function
-- is 5xx / timed out / not deployed, that hour's batch simply doesn't happen.
-- The *next* successful hourly run self-heals (its query is `scheduled_for <=
-- now()`), so notifications are *delayed*, not lost — but a multi-hour outage
-- is invisible to anyone. This adds:
--   1. dispatch_health — a single-row table the dispatcher writes a heartbeat to
--      (last_run_at on every claimed run, last_ok_at + last_counts on clean
--      finish, last_error on a thrown run). Service-role only.
--   2. dispatch-health-check — a pure-SQL cron at :30 past the hour that
--      re-fires dispatch-notifications iff last_ok_at is >90min stale. This is a
--      retry, not just an alarm: the dispatcher is idempotent (per-row CAS claim
--      + email_sent_at markers), so re-firing is always safe.

CREATE TABLE IF NOT EXISTS public.dispatch_health (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_run_at timestamptz,
  last_ok_at timestamptz,
  last_error text,
  last_counts jsonb
);

-- Seed the singleton row so the dispatcher's upsert always has a target and
-- dispatch-health-check has something to read.
INSERT INTO public.dispatch_health (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.dispatch_health ENABLE ROW LEVEL SECURITY;

-- No client access ever — only the service-role dispatcher writes it, and the
-- pg_cron health-check (running as the migration owner) reads it. RLS-enabled
-- with this policy means anon/authenticated see zero rows.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'dispatch_health' AND policyname = 'no direct access'
  ) THEN
    CREATE POLICY "no direct access" ON public.dispatch_health FOR ALL USING (false) WITH CHECK (false);
  END IF;
END $$;

-- Health-check cron: at :30 every hour, if no successful dispatch in 90 minutes
-- (covers a missed :00 run), re-fire the dispatcher with the same x-cron-secret
-- the hourly job uses. The net.http_post in the SELECT list is only evaluated
-- when the WHERE row survives, so a healthy dispatcher costs nothing here.
SELECT cron.unschedule('dispatch-health-check')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dispatch-health-check');

SELECT cron.schedule(
  'dispatch-health-check',
  '30 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://wsvdtwxzyskwpiyijpqg.supabase.co/functions/v1/dispatch-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'cron_dispatch_secret'
        LIMIT 1
      )
    ),
    body    := '{}'::jsonb
  )
  WHERE COALESCE(
    (SELECT now() - last_ok_at FROM public.dispatch_health WHERE id = 1),
    interval '999 hours'
  ) > interval '90 minutes';
  $$
);
