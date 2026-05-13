-- Drop orphaned SMTP sending infrastructure (post-v2 cleanup).
-- The v2 email-only-auth migration (20260513000000) made SMTP unreachable: the
-- smtp-verify edge function has been deleted, no client code writes to or reads
-- from smtp_connections, and the auth.users truncate cascaded out all existing
-- rows. The table, its view, and its upsert RPC are dead weight.

-- Sweep any orphan vault entries created by the old SMTP encryption path so
-- dropping the FK column doesn't leave decryptable plaintext lingering in
-- vault.secrets.
do $$
declare
  r record;
begin
  for r in select id from vault.secrets where name like 'smtp_pwd_%'
  loop
    delete from vault.secrets where id = r.id;
  end loop;
end $$;

drop function if exists public.upsert_smtp_connection(uuid, text, text, text, int, text, text, boolean);
drop view     if exists public.smtp_connections_safe;
drop table    if exists public.smtp_connections cascade;
