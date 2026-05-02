-- Per-(subject, function) per-day counter, layered on top of rate_limits to
-- catch attackers who pace themselves under the 1-minute ceiling but rack up
-- thousands of paid-API calls across the day.
create table if not exists public.daily_quotas (
  subject text not null,
  function_name text not null,
  day date not null,
  call_count int not null default 0,
  primary key (subject, function_name, day)
);

alter table public.daily_quotas enable row level security;

create policy "no direct access"
  on public.daily_quotas
  for all
  using (false)
  with check (false);

create or replace function public.increment_daily_quota(
  p_subject text,
  p_function_name text,
  p_day date
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count int;
begin
  insert into public.daily_quotas (subject, function_name, day, call_count)
  values (p_subject, p_function_name, p_day, 1)
  on conflict (subject, function_name, day)
  do update set call_count = public.daily_quotas.call_count + 1
  returning call_count into new_count;
  return new_count;
end;
$$;

revoke all on function public.increment_daily_quota(text, text, date) from public;
revoke all on function public.increment_daily_quota(text, text, date) from anon, authenticated;
grant execute on function public.increment_daily_quota(text, text, date) to service_role;

create or replace function public.prune_daily_quotas()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.daily_quotas where day < (current_date - interval '14 days');
$$;

revoke all on function public.prune_daily_quotas() from public;
grant execute on function public.prune_daily_quotas() to service_role;
