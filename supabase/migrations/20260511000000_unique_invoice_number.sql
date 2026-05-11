-- Enforce one invoice_number per user.
--
-- createInvoice() picks the number with a SELECT-then-INSERT (user-supplied) or a
-- read-MAX-then-retry loop (auto-generated). Both are TOCTOU-racy: two near-simultaneous
-- submits (a double-tapped "Create Invoice") can both pass the check and land two
-- invoices that share a number, which then confuses the AI follow-ups and the detail
-- screen (both key on invoice_number). The client now also has a synchronous in-flight
-- guard, but a unique constraint is the durable fix — the losing INSERT gets a clean
-- 23505 the existing error path already handles.

-- First de-duplicate any pre-existing collisions so ADD CONSTRAINT can't fail (23505
-- against old data). Keep the earliest-created invoice's number untouched; later
-- duplicates get "-2", "-3", ... appended. This only touches rows that are already
-- ambiguous, and the suffix makes the situation visible rather than silently picking one.
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY user_id, invoice_number ORDER BY created_at, id) AS rn
  FROM public.invoices
)
UPDATE public.invoices i
SET invoice_number = i.invoice_number || '-' || r.rn
FROM ranked r
WHERE i.id = r.id AND r.rn > 1;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_user_id_invoice_number_key UNIQUE (user_id, invoice_number);
