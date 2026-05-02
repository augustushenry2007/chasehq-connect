ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_step int DEFAULT 1;

UPDATE public.profiles
  SET onboarding_step = 6
  WHERE onboarding_completed = true AND onboarding_step IS NULL;
