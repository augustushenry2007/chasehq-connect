-- §9: ON DELETE CASCADE FKs to auth.users for the last user-scoped tables that
-- still lack one. delete-account explicitly deletes every user-scoped table by
-- user_id, but if that edge function partially fails (crash / transport error
-- between deletes) these rows orphan with no DB-level cleanup — and the deletion
-- dialog promises "This permanently deletes your account, invoices, and
-- follow-ups." The other user tables already carry this constraint (invoices,
-- followups, smtp_connections, subscriptions, subscription_events, notifications,
-- followup_schedules, notification_preferences).
--
-- Each table is guarded with to_regclass so an environment that's missing one of
-- these tables (drift between migration history and actual schema) doesn't break
-- the migration. Pre-existing orphans are swept first so ADD CONSTRAINT doesn't
-- 23503 against old data (there shouldn't be any).

DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    DELETE FROM public.profiles WHERE user_id NOT IN (SELECT id FROM auth.users);
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_profiles_user') THEN
      ALTER TABLE public.profiles
        ADD CONSTRAINT fk_profiles_user
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
  END IF;

  IF to_regclass('public.email_send_log') IS NOT NULL THEN
    DELETE FROM public.email_send_log WHERE user_id NOT IN (SELECT id FROM auth.users);
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_email_send_log_user') THEN
      ALTER TABLE public.email_send_log
        ADD CONSTRAINT fk_email_send_log_user
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
  END IF;

  IF to_regclass('public.gmail_connections') IS NOT NULL THEN
    DELETE FROM public.gmail_connections WHERE user_id NOT IN (SELECT id FROM auth.users);
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_gmail_connections_user') THEN
      ALTER TABLE public.gmail_connections
        ADD CONSTRAINT fk_gmail_connections_user
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;
