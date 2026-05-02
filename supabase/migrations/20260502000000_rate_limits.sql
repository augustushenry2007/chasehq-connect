-- Per-(subject, function) sliding-window counter for paid-API edge functions.
-- "subject" is a freeform identifier so the same table works for both
-- authenticated calls (subject = user uuid) and anonymous calls (subject = "ip:1.2.3.4").
-- Each call to increment_rate_limit upserts a row keyed by (subject, fn, minute_window)
-- and returns the post-increment count. The edge function compares against a per-fn ceiling.
create table if not exists public.rate_limits (
  subject text not null,
  function_name text not null,
  window_start timestamptz not null,
  call_count int not null default 0,
  primary key (subject, function_name, window_start)
);

alter table public.rate_limits enable row level security;

-- No one can read or write rate_limits directly. The increment_rate_limit RPC
-- runs as security definer so edge functions (with the service-role JWT) can
-- still bump counters without exposing the table to clients.
create policy "no direct access"
  on public.rate_limits
  for all
  using (false)
  with check (false);

create or replace function public.increment_rate_limit(
  p_subject text,
  p_function_name text,
  p_window_start timestamptz
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count int;
begin
  insert into public.rate_limits (subject, function_name, window_start, call_count)
  values (p_subject, p_function_name, p_window_start, 1)
  on conflict (subject, function_name, window_start)
  do update set call_count = public.rate_limits.call_count + 1
  returning call_count into new_count;
  return new_count;
end;
$$;

-- Lock down the RPC: only the service role (i.e. edge functions) can call it.
-- Anon and authenticated client roles are blocked.
revoke all on function public.increment_rate_limit(text, text, timestamptz) from public;
revoke all on function public.increment_rate_limit(text, text, timestamptz) from anon, authenticated;
grant execute on function public.increment_rate_limit(text, text, timestamptz) to service_role;

-- Old rows are noise after their minute passes. A periodic prune keeps the
-- table tiny (Supabase scheduled cron can call this nightly).
create or replace function public.prune_rate_limits()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.rate_limits where window_start < now() - interval '1 hour';
$$;

revoke all on function public.prune_rate_limits() from public;
grant execute on function public.prune_rate_limits() to service_role;
