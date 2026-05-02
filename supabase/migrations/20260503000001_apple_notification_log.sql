-- Idempotency log for Apple App Store Server Notifications V2.
-- Apple includes a unique notificationUUID with every notification; this table
-- ensures we process each one at most once. If Apple retries (delivery failures,
-- their own retry policy), the second insert hits a unique-key conflict and we
-- short-circuit without re-applying the state change.
create table if not exists public.apple_notification_log (
  notification_uuid text primary key,
  received_at timestamptz not null default now(),
  notification_type text,
  subtype text,
  original_transaction_id text,
  processed_ok boolean not null default false
);

alter table public.apple_notification_log enable row level security;

-- Only service_role writes / reads. No client access ever.
create policy "no direct access"
  on public.apple_notification_log
  for all
  using (false)
  with check (false);

create index if not exists apple_notification_log_received_at_idx
  on public.apple_notification_log (received_at desc);

-- Periodic prune: keep 90 days of history for forensic replay, drop older.
create or replace function public.prune_apple_notification_log()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.apple_notification_log where received_at < now() - interval '90 days';
$$;

revoke all on function public.prune_apple_notification_log() from public;
grant execute on function public.prune_apple_notification_log() to service_role;
