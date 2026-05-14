-- Atomic schedule editor. ChaseSchedule.persist() used to do three sequential
-- writes from the client (upsert followup_schedules → delete pending
-- notifications → insert new notifications). A crash/network drop between
-- steps left mixed-state rows: either the old + new notifications coexisting
-- (double-send) or no rows at all (silent broken schedule). Doing it in a
-- single SECURITY INVOKER PL/pgSQL function makes the three writes one
-- transaction — they all commit or all roll back.

CREATE OR REPLACE FUNCTION public.persist_chase_schedule(
  p_invoice_id uuid,
  p_steps jsonb,
  p_timezone text,
  p_paused boolean,
  p_notifications jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;

  -- Defensive: the invoice must exist AND be owned by the caller. RLS would
  -- block a misowned upsert/insert below anyway, but failing early gives a
  -- clearer error and short-circuits the writes.
  IF NOT EXISTS (
    SELECT 1 FROM public.invoices WHERE id = p_invoice_id AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'invoice not found or not owned by caller' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.followup_schedules (invoice_id, user_id, steps, timezone, paused)
  VALUES (p_invoice_id, v_uid, p_steps, p_timezone, p_paused)
  ON CONFLICT (invoice_id) DO UPDATE
    SET steps = EXCLUDED.steps,
        timezone = EXCLUDED.timezone,
        paused = EXCLUDED.paused,
        updated_at = now();

  DELETE FROM public.notifications
    WHERE invoice_id = p_invoice_id AND status = 'pending';

  IF NOT p_paused AND jsonb_array_length(p_notifications) > 0 THEN
    INSERT INTO public.notifications (
      user_id, invoice_id, schedule_step_index, type, title, body, scheduled_for, status
    )
    SELECT
      v_uid,
      p_invoice_id,
      (n->>'schedule_step_index')::smallint,
      (n->>'type')::public.notification_type,
      n->>'title',
      n->>'body',
      (n->>'scheduled_for')::timestamptz,
      'pending'::public.notification_status
    FROM jsonb_array_elements(p_notifications) AS n;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.persist_chase_schedule(uuid, jsonb, text, boolean, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.persist_chase_schedule(uuid, jsonb, text, boolean, jsonb) TO authenticated;
