CREATE TYPE public.invoice_status AS ENUM ('Escalated', 'Overdue', 'Follow-up', 'Upcoming', 'Paid');

CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  client TEXT NOT NULL,
  client_email TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  status invoice_status NOT NULL DEFAULT 'Upcoming',
  days_past_due INTEGER NOT NULL DEFAULT 0,
  sent_from TEXT NOT NULL DEFAULT '',
  payment_details TEXT NOT NULL DEFAULT '',
  client_reply_snippet TEXT,
  client_reply_received_at TIMESTAMPTZ,
  client_reply_sender_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.followups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  tone TEXT NOT NULL DEFAULT 'Friendly',
  subject TEXT,
  message TEXT NOT NULL,
  is_ai_generated BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own invoices" ON public.invoices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own invoices" ON public.invoices FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own invoices" ON public.invoices FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own invoices" ON public.invoices FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own followups" ON public.followups FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own followups" ON public.followups FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own followups" ON public.followups FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own followups" ON public.followups FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();