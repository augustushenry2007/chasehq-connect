-- Schedule dispatch-notifications to run every hour via pg_cron + pg_net.
--
-- Before running: enable pg_cron and pg_net in Supabase Dashboard →
-- Database → Extensions. Also add RESEND_API_KEY in Edge Functions → Secrets.
--
-- dispatch-notifications has verify_jwt = false, so no Authorization header needed.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove existing job before re-creating (idempotent)
SELECT cron.unschedule('dispatch-notifications-hourly')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dispatch-notifications-hourly');

SELECT cron.schedule(
  'dispatch-notifications-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://wsvdtwxzyskwpiyijpqg.supabase.co/functions/v1/dispatch-notifications',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := '{}'::jsonb
  );
  $$
);
