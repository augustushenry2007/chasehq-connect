-- v2 redesign: email-only auth + ChaseHQ-hosted sending only.
-- Drops everything tied to the old OAuth + Gmail-send architecture and wipes
-- existing TestFlight accounts so the next launch starts from a clean slate.

-- Gmail connections table + helper RPC: no more user-mailbox sending.
drop table if exists public.gmail_connections cascade;
drop function if exists public.upsert_gmail_connection cascade;

-- sender_type column: every send goes through Resend now.
alter table public.profiles drop column if exists sender_type;

-- Wipe existing TestFlight / dev accounts. auth.users cascades to public.profiles,
-- public.subscriptions, public.invoices, public.followups, public.email_send_log,
-- public.notifications, public.notification_preferences, public.followup_schedules
-- via existing FK constraints. Confirmed destructive per the v2 product decision —
-- TestFlight user base is small and a clean slate avoids OAuth-provider identity
-- collisions with the new OTP signup flow.
truncate auth.users cascade;
