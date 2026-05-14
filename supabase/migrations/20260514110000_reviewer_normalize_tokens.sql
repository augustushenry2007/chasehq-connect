-- Round 2 fix for the reviewer seed. The prior round added the missing
-- auth.identities row but left several auth.users columns NULL. GoTrue's user
-- model scans these columns into Go `string` (not sql.NullString), so NULL
-- crashes the read with "converting NULL to string is unsupported" before any
-- auth logic runs -- including before audit logging, which is why
-- auth.audit_log_entries shows zero verify-call entries.
--
-- Setting all known varchar token columns to '' matches the shape
-- admin.auth.admin.createUser writes atomically.
UPDATE auth.users
SET
  confirmation_token         = COALESCE(confirmation_token, ''),
  recovery_token             = COALESCE(recovery_token, ''),
  email_change_token_new     = COALESCE(email_change_token_new, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  email_change               = COALESCE(email_change, ''),
  reauthentication_token     = COALESCE(reauthentication_token, ''),
  phone_change               = COALESCE(phone_change, ''),
  phone_change_token         = COALESCE(phone_change_token, ''),
  -- admin.createUser writes '' for passwordless accounts, not NULL. The previous
  -- migration set this to NULL based on an unverified assumption. Restore to ''.
  encrypted_password         = ''
WHERE email = 'appreview@chasehq.app';
