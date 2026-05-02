-- Daily reconciliation of invoices.status and invoices.days_past_due.
--
-- Until now both columns were written once on insert and never updated. That
-- left server-side consumers (notification dispatch cron, email summaries,
-- and any DB-level filtering) reading stale data the moment a due date
-- passed. The frontend papers over this by recomputing on render via
-- src/lib/invoiceStatus.ts; this migration brings the database in line with
-- the same thresholds so client and server agree.
--
-- Mirrors the thresholds in src/lib/invoiceStatus.ts. Keep them in sync.

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.reconcile_invoice_status() RETURNS void AS $$
BEGIN
  UPDATE public.invoices
  SET
    days_past_due = GREATEST(0, (CURRENT_DATE - due_date)::int),
    status = CASE
      WHEN status = 'Paid'                        THEN 'Paid'::invoice_status
      WHEN (CURRENT_DATE - due_date) >= 21        THEN 'Escalated'::invoice_status
      WHEN (CURRENT_DATE - due_date) >= 1         THEN 'Overdue'::invoice_status
      WHEN (due_date - CURRENT_DATE) <= 7         THEN 'Follow-up'::invoice_status
      ELSE 'Upcoming'::invoice_status
    END
  WHERE status <> 'Paid';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Daily at 06:00 UTC. Idempotent re-creation.
SELECT cron.unschedule('reconcile-invoice-status-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reconcile-invoice-status-daily');

SELECT cron.schedule(
  'reconcile-invoice-status-daily',
  '0 6 * * *',
  $$ SELECT public.reconcile_invoice_status(); $$
);
