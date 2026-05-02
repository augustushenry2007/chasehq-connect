-- Supabase RPC requires functions in the public schema. Built-in
-- pg_try_advisory_lock(key) lives in pg_catalog and isn't callable via the
-- REST RPC layer, so we wrap it here. Returns true if the caller now holds
-- the advisory lock for the given key, false if another session holds it.
create or replace function public.pg_try_advisory_lock(key bigint)
returns boolean
language sql
security definer
set search_path = public
as $$
  select pg_catalog.pg_try_advisory_lock(key);
$$;

revoke all on function public.pg_try_advisory_lock(bigint) from public;
revoke all on function public.pg_try_advisory_lock(bigint) from anon, authenticated;
grant execute on function public.pg_try_advisory_lock(bigint) to service_role;
