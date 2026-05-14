-- Complete the reviewer-account seed: previous migration only wrote auth.users.
-- admin.auth.admin.createUser atomically writes auth.users + auth.identities;
-- our SQL-only seed left identities empty, so /auth/v1/verify cannot resolve an
-- email-provider identity and returns non-2xx -> reviewer-signin returns 500.

-- 1. Normalize encrypted_password to NULL (matches passwordless accounts created
--    via admin.createUser({ email_confirm: true })).
UPDATE auth.users
SET encrypted_password = NULL
WHERE email = 'appreview@chasehq.app'
  AND encrypted_password = '';

-- 2. Insert the email-provider identity row if missing.
--    provider_id = user.id::text is the canonical shape for the "email" provider.
INSERT INTO auth.identities (
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  u.id::text,
  u.id,
  jsonb_build_object(
    'sub',             u.id::text,
    'email',           u.email,
    'email_verified',  true,
    'phone_verified',  false
  ),
  'email',
  NOW(),
  NOW(),
  NOW()
FROM auth.users u
WHERE u.email = 'appreview@chasehq.app'
  AND NOT EXISTS (
    SELECT 1 FROM auth.identities i
    WHERE i.user_id = u.id AND i.provider = 'email'
  );
