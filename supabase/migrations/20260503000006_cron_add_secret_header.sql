-- Update dispatch-notifications cron job to require x-cron-secret header (Fix H1).
--
-- The secret value lives in Supabase Vault (pgsodium) under the name
-- 'cron_dispatch_secret'. It was stored once via:
--   SELECT vault.create_secret('<value>', 'cron_dispatch_secret', '...');
-- and is referenced here via vault.decrypted_secrets — never stored in git.
--
-- If the vault entry is missing the subquery returns NULL, causing
-- dispatch-notifications to return 401 — fail-safe behaviour.

SELECT cron.unschedule('dispatch-notifications-hourly')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dispatch-notifications-hourly');

SELECT cron.schedule(
  'dispatch-notifications-hourly',
  '0 * * * *',
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
  );
  $$
);
