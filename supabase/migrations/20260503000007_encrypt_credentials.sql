-- H4/H5: Encrypt SMTP passwords and Gmail tokens at rest using Supabase Vault.
--
-- Strategy:
--   1. Add *_secret_id uuid columns to hold vault secret UUIDs.
--   2. Migrate all existing plaintext values into vault.create_secret().
--   3. Drop the plaintext columns.
--   4. Create SECURITY DEFINER helper RPCs so edge functions (running as
--      service_role) can read and update secrets without direct vault table access.
--   5. Create upsert RPCs for gmail and smtp connections so all vault writes
--      flow through a single trusted code path.

-- ============================================================
-- Step 1: Add vault reference columns
-- ============================================================

ALTER TABLE gmail_connections
  ADD COLUMN access_token_secret_id  uuid,
  ADD COLUMN refresh_token_secret_id uuid;

ALTER TABLE smtp_connections
  ADD COLUMN smtp_password_secret_id uuid;

-- ============================================================
-- Step 2: Backfill existing rows into vault
-- ============================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id, user_id, access_token, refresh_token
    FROM gmail_connections
    WHERE access_token IS NOT NULL
  LOOP
    UPDATE gmail_connections SET
      access_token_secret_id  = vault.create_secret(r.access_token,  'gmail_at_'  || r.user_id::text),
      refresh_token_secret_id = CASE
        WHEN r.refresh_token IS NOT NULL
          THEN vault.create_secret(r.refresh_token, 'gmail_rt_' || r.user_id::text)
        ELSE NULL
      END
    WHERE id = r.id;
  END LOOP;

  FOR r IN
    SELECT user_id, smtp_password
    FROM smtp_connections
    WHERE smtp_password IS NOT NULL
  LOOP
    UPDATE smtp_connections SET
      smtp_password_secret_id = vault.create_secret(r.smtp_password, 'smtp_pwd_' || r.user_id::text)
    WHERE user_id = r.user_id;
  END LOOP;
END $$;

-- ============================================================
-- Step 3: Drop plaintext columns
-- ============================================================

ALTER TABLE gmail_connections
  DROP COLUMN access_token,
  DROP COLUMN refresh_token;

ALTER TABLE smtp_connections
  DROP COLUMN smtp_password;

-- ============================================================
-- Step 4: Helper RPCs (SECURITY DEFINER, service_role only)
-- ============================================================

-- Read a vault secret by UUID.
CREATE OR REPLACE FUNCTION vault_read_secret(p_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_id IS NULL THEN RETURN NULL; END IF;
  RETURN (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = p_id);
END;
$$;
REVOKE ALL ON FUNCTION vault_read_secret(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION vault_read_secret(uuid) TO service_role;

-- Update an existing vault secret by UUID.
CREATE OR REPLACE FUNCTION vault_update_secret(p_id uuid, p_value text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_id IS NULL OR p_value IS NULL THEN RETURN; END IF;
  PERFORM vault.update_secret(p_id, p_value);
END;
$$;
REVOKE ALL ON FUNCTION vault_update_secret(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION vault_update_secret(uuid, text) TO service_role;

-- ============================================================
-- Step 5: Upsert RPCs (vault-aware write path)
-- ============================================================

-- gmail_connections upsert.
-- On conflict: update vault secrets in-place; update non-secret columns.
-- On insert: create new vault secrets; insert row.
-- Note: refresh_token may be null on a token refresh (Google only returns it
-- on the first OAuth flow; subsequent refreshes omit it — preserve existing).
CREATE OR REPLACE FUNCTION upsert_gmail_connection(
  p_user_id          uuid,
  p_email            text,
  p_access_token     text,
  p_refresh_token    text,   -- NULL = keep existing vault secret unchanged
  p_token_expires_at timestamptz
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_at_id  uuid;
  v_rt_id  uuid;
BEGIN
  SELECT access_token_secret_id, refresh_token_secret_id
  INTO   v_at_id, v_rt_id
  FROM   gmail_connections
  WHERE  user_id = p_user_id;

  IF FOUND THEN
    -- Update access token in vault
    PERFORM vault.update_secret(v_at_id, p_access_token);

    -- Update refresh token only when caller supplies a new one
    IF p_refresh_token IS NOT NULL THEN
      IF v_rt_id IS NOT NULL THEN
        PERFORM vault.update_secret(v_rt_id, p_refresh_token);
      ELSE
        v_rt_id := vault.create_secret(p_refresh_token, 'gmail_rt_' || p_user_id::text);
        UPDATE gmail_connections SET refresh_token_secret_id = v_rt_id WHERE user_id = p_user_id;
      END IF;
    END IF;

    -- Update non-secret columns
    UPDATE gmail_connections SET
      email            = p_email,
      token_expires_at = p_token_expires_at,
      updated_at       = now()
    WHERE user_id = p_user_id;

  ELSE
    -- Create vault secrets
    v_at_id := vault.create_secret(p_access_token, 'gmail_at_' || p_user_id::text);
    v_rt_id := CASE
      WHEN p_refresh_token IS NOT NULL
        THEN vault.create_secret(p_refresh_token, 'gmail_rt_' || p_user_id::text)
      ELSE NULL
    END;

    INSERT INTO gmail_connections
      (user_id, email, access_token_secret_id, refresh_token_secret_id, token_expires_at)
    VALUES
      (p_user_id, p_email, v_at_id, v_rt_id, p_token_expires_at);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION upsert_gmail_connection(uuid, text, text, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_gmail_connection(uuid, text, text, text, timestamptz) TO service_role;

-- smtp_connections upsert.
CREATE OR REPLACE FUNCTION upsert_smtp_connection(
  p_user_id      uuid,
  p_from_email   text,
  p_from_name    text,
  p_smtp_host    text,
  p_smtp_port    int,
  p_smtp_username text,
  p_smtp_password text,
  p_verified     boolean DEFAULT false
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pwd_id uuid;
BEGIN
  SELECT smtp_password_secret_id INTO v_pwd_id
  FROM smtp_connections WHERE user_id = p_user_id;

  IF FOUND THEN
    PERFORM vault.update_secret(v_pwd_id, p_smtp_password);
    UPDATE smtp_connections SET
      from_email    = p_from_email,
      from_name     = p_from_name,
      smtp_host     = p_smtp_host,
      smtp_port     = p_smtp_port,
      smtp_username = p_smtp_username,
      verified      = p_verified,
      updated_at    = now()
    WHERE user_id = p_user_id;
  ELSE
    v_pwd_id := vault.create_secret(p_smtp_password, 'smtp_pwd_' || p_user_id::text);
    INSERT INTO smtp_connections
      (user_id, from_email, from_name, smtp_host, smtp_port, smtp_username, smtp_password_secret_id, verified)
    VALUES
      (p_user_id, p_from_email, p_from_name, p_smtp_host, p_smtp_port, p_smtp_username, v_pwd_id, p_verified);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION upsert_smtp_connection(uuid, text, text, text, int, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_smtp_connection(uuid, text, text, text, int, text, text, boolean) TO service_role;
