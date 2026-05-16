-- RLS Hardening
--
-- Fix 1: notifications INSERT must verify invoice belongs to the inserting user.
--        dispatch-notifications runs as service_role (bypasses RLS), so a user who
--        inserts a notification with a foreign invoice_id would cause the cron to send
--        them an email containing that invoice's client name, number, and amount.
DROP POLICY "users insert own notifications" ON public.notifications;
CREATE POLICY "users insert own notifications" ON public.notifications
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM public.invoices WHERE id = invoice_id AND user_id = auth.uid())
  );

-- Fix 2: followup_schedules INSERT same gap. invoice_id also carries a UNIQUE constraint,
--        so an attacker could additionally prevent a victim from ever scheduling a
--        follow-up for their own invoice (denial-of-notification).
DROP POLICY "users insert own schedules" ON public.followup_schedules;
CREATE POLICY "users insert own schedules" ON public.followup_schedules
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM public.invoices WHERE id = invoice_id AND user_id = auth.uid())
  );

-- Fix 3: has_active_entitlement() was never REVOKE'd — any authenticated user could
--        probe whether any other user (by UUID) has an active subscription.
--        send-email calls this via supabaseAdmin (service_role), so restricting to
--        service_role only is safe and does not break anything.
REVOKE ALL ON FUNCTION public.has_active_entitlement(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_entitlement(uuid) TO service_role;

-- Fix 4: The vault migration (20260503000007) made direct writes to gmail_connections
--        and smtp_connections obsolete — all mutations now flow through SECURITY DEFINER
--        upsert RPCs restricted to service_role. Drop the now-dead direct INSERT/UPDATE
--        policies to close the redundant attack surface.
DROP POLICY "Users can insert their own gmail connection" ON public.gmail_connections;
DROP POLICY "Users can update their own gmail connection" ON public.gmail_connections;
DROP POLICY "Users can insert their own smtp connection" ON public.smtp_connections;
DROP POLICY "Users can update their own smtp connection" ON public.smtp_connections;

-- Fix 5: Explicit WITH CHECK on all UPDATE policies.
--        PostgreSQL defaults WITH CHECK to the USING expression, so these are currently
--        safe, but being explicit prevents future confusion if policies are edited.

DROP POLICY "Users can update their own invoices" ON public.invoices;
CREATE POLICY "Users can update their own invoices" ON public.invoices
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY "Users can update their own followups" ON public.followups;
CREATE POLICY "Users can update their own followups" ON public.followups
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY "users update own prefs" ON public.notification_preferences;
CREATE POLICY "users update own prefs" ON public.notification_preferences
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY "users update own schedules" ON public.followup_schedules;
CREATE POLICY "users update own schedules" ON public.followup_schedules
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY "users update own notifications" ON public.notifications;
CREATE POLICY "users update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Fix 6: FK constraints with ON DELETE CASCADE so that deleting a user from auth.users
--        (e.g. via the delete-account edge function or directly) cannot orphan rows in
--        these three tables. The other user tables (invoices, followups, profiles,
--        gmail_connections, smtp_connections) already carry this constraint.
--
-- First sweep up any pre-existing orphans (rows whose user was deleted before this
-- FK existed) — otherwise ADD CONSTRAINT fails with a 23503 against the old data.
DELETE FROM public.notifications              WHERE user_id NOT IN (SELECT id FROM auth.users);
DELETE FROM public.followup_schedules         WHERE user_id NOT IN (SELECT id FROM auth.users);
DELETE FROM public.notification_preferences   WHERE user_id NOT IN (SELECT id FROM auth.users);

ALTER TABLE public.notifications
  ADD CONSTRAINT fk_notifications_user
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.followup_schedules
  ADD CONSTRAINT fk_followup_schedules_user
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.notification_preferences
  ADD CONSTRAINT fk_notification_preferences_user
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
