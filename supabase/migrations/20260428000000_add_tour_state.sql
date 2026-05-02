ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tour_completed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dismissed_hints JSONB NOT NULL DEFAULT '{}'::jsonb;
