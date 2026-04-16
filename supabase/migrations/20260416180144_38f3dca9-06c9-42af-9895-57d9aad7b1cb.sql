
CREATE TABLE public.gmail_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.gmail_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own gmail connection"
  ON public.gmail_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own gmail connection"
  ON public.gmail_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own gmail connection"
  ON public.gmail_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own gmail connection"
  ON public.gmail_connections FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_gmail_connections_updated_at
  BEFORE UPDATE ON public.gmail_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
