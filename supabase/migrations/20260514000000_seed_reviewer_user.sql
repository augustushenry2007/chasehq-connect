-- Pre-seed the App Review bypass account so reviewer-signin never calls createUser.
-- GoTrue cannot verify a magic link for a user created in the same request;
-- pre-existing the user eliminates that code path entirely.
-- Fixed UUID keeps the row stable across pushes; ON CONFLICT is fully idempotent.
INSERT INTO auth.users (
  id, instance_id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'appreview@chasehq.app',
  '',
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;
