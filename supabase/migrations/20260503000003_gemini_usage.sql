-- Cost telemetry for Gemini calls. Every successful generate-* invocation
-- writes one row so we can answer "how much are we spending and where?"
-- and trigger anomaly alerts.
create table if not exists public.gemini_usage (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  function_name text not null,
  subject text not null,             -- 'ip:1.2.3.4' or '<user_uuid>'
  model text not null,
  input_tokens int,
  output_tokens int,
  total_tokens int,
  cost_estimate_usd numeric(10, 6),  -- our best estimate at log time
  prompt_injection_attempts int not null default 0
);

alter table public.gemini_usage enable row level security;

create policy "no direct access"
  on public.gemini_usage
  for all
  using (false)
  with check (false);

create index if not exists gemini_usage_created_at_idx
  on public.gemini_usage (created_at desc);

create index if not exists gemini_usage_subject_idx
  on public.gemini_usage (subject, created_at desc);

create or replace function public.prune_gemini_usage()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.gemini_usage where created_at < now() - interval '90 days';
$$;

revoke all on function public.prune_gemini_usage() from public;
grant execute on function public.prune_gemini_usage() to service_role;
