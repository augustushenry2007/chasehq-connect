-- Notification preferences (one row per user)
CREATE TABLE public.notification_preferences (
  user_id uuid PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT false,
  push_enabled boolean NOT NULL DEFAULT true,
  quiet_hours_start smallint NOT NULL DEFAULT 21 CHECK (quiet_hours_start BETWEEN 0 AND 23),
  quiet_hours_end smallint NOT NULL DEFAULT 8 CHECK (quiet_hours_end BETWEEN 0 AND 23),
  timezone text NOT NULL DEFAULT 'UTC',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users select own prefs" ON public.notification_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own prefs" ON public.notification_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own prefs" ON public.notification_preferences FOR UPDATE USING (auth.uid() = user_id);
CREATE TRIGGER trg_prefs_updated_at BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Followup schedules (one per invoice)
CREATE TABLE public.followup_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  timezone text NOT NULL DEFAULT 'UTC',
  paused boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_followup_schedules_user ON public.followup_schedules(user_id);
ALTER TABLE public.followup_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users select own schedules" ON public.followup_schedules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own schedules" ON public.followup_schedules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own schedules" ON public.followup_schedules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users delete own schedules" ON public.followup_schedules FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_schedules_updated_at BEFORE UPDATE ON public.followup_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Notifications queue + inbox
CREATE TYPE public.notification_type AS ENUM ('due', 'followup', 'escalation');
CREATE TYPE public.notification_status AS ENUM ('pending', 'delivered', 'read', 'canceled', 'failed');

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  schedule_step_index smallint NOT NULL,
  type public.notification_type NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  scheduled_for timestamptz NOT NULL,
  status public.notification_status NOT NULL DEFAULT 'pending',
  attempts smallint NOT NULL DEFAULT 0,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (invoice_id, schedule_step_index, type)
);
CREATE INDEX idx_notifications_user_status ON public.notifications(user_id, status);
CREATE INDEX idx_notifications_pending_due ON public.notifications(scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_notifications_invoice ON public.notifications(invoice_id);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users select own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own notifications" ON public.notifications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users delete own notifications" ON public.notifications FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_notifications_updated_at BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Cancel pending notifications when invoice is marked Paid or deleted
CREATE OR REPLACE FUNCTION public.cancel_notifications_on_invoice_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    UPDATE public.notifications SET status = 'canceled'
      WHERE invoice_id = OLD.id AND status = 'pending';
    DELETE FROM public.followup_schedules WHERE invoice_id = OLD.id;
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE' AND NEW.status = 'Paid' AND OLD.status <> 'Paid') THEN
    UPDATE public.notifications SET status = 'canceled'
      WHERE invoice_id = NEW.id AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_invoice_cancel_notifications
  AFTER UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.cancel_notifications_on_invoice_change();