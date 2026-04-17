-- Enum for subscription status
CREATE TYPE public.subscription_status AS ENUM (
  'none',
  'trialing',
  'active',
  'past_due',
  'canceled',
  'expired'
);

-- Subscriptions table (single row per user)
CREATE TABLE public.subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.subscription_status NOT NULL DEFAULT 'none',
  plan text NOT NULL DEFAULT 'chasehq_pro_monthly',
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  canceled_at timestamptz,
  apple_original_transaction_id text,
  apple_latest_receipt text,
  stripe_customer_id text,
  stripe_subscription_id text,
  last_event_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_apple_otid ON public.subscriptions(apple_original_transaction_id);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read their own subscription. No client-side writes (service role only).
CREATE POLICY "Users can view own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Trigger to maintain updated_at
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Audit/event log
CREATE TABLE public.subscription_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscription_events_user_id ON public.subscription_events(user_id);
CREATE INDEX idx_subscription_events_created_at ON public.subscription_events(created_at DESC);

ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription events"
  ON public.subscription_events FOR SELECT
  USING (auth.uid() = user_id);

-- Entitlement helper: returns true if the user has an active paid sub
-- or a trial that hasn't ended yet. Used by send-email to gate sending.
CREATE OR REPLACE FUNCTION public.has_active_entitlement(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.user_id = _user_id
      AND (
        (s.status = 'trialing' AND s.trial_ends_at IS NOT NULL AND s.trial_ends_at > now())
        OR (s.status = 'active' AND (s.current_period_end IS NULL OR s.current_period_end > now()))
        OR (s.status = 'past_due' AND s.current_period_end IS NOT NULL AND s.current_period_end > now())
      )
  );
$$;