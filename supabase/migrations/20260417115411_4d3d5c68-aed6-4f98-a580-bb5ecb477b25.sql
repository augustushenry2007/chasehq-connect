
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS email_provider text DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS sender_type text DEFAULT 'none';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_full_name text;
  v_provider text;
BEGIN
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    NULL
  );
  v_provider := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');

  INSERT INTO public.profiles (user_id, onboarding_completed, full_name, email_provider)
  VALUES (NEW.id, false, v_full_name, v_provider)
  ON CONFLICT (user_id) DO UPDATE
    SET full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        email_provider = COALESCE(EXCLUDED.email_provider, public.profiles.email_provider);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE IF NOT EXISTS public.smtp_connections (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  from_email text NOT NULL,
  from_name text,
  smtp_host text NOT NULL,
  smtp_port int NOT NULL DEFAULT 587,
  smtp_username text NOT NULL,
  smtp_password text NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.smtp_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own smtp connection"
  ON public.smtp_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own smtp connection"
  ON public.smtp_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own smtp connection"
  ON public.smtp_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own smtp connection"
  ON public.smtp_connections FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_smtp_connections_updated_at
  BEFORE UPDATE ON public.smtp_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE VIEW public.smtp_connections_safe
WITH (security_invoker = true)
AS
SELECT
  user_id,
  from_email,
  from_name,
  smtp_host,
  smtp_port,
  smtp_username,
  verified,
  created_at,
  updated_at
FROM public.smtp_connections;

GRANT SELECT ON public.smtp_connections_safe TO authenticated;
