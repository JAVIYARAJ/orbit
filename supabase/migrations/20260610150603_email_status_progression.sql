-- Track engagement statuses (opened, clicked) and make status updates
-- progression-aware so out-of-order Brevo events never downgrade the status.
-- Lifecycle: sent -> delivered -> opened -> clicked. Failure events
-- (bounced/blocked/spam/invalid/failed) always take precedence.

CREATE OR REPLACE FUNCTION public.email_status_rank(p_status text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE lower(coalesce(p_status, ''))
    WHEN 'sent'      THEN 1
    WHEN 'delivered' THEN 2
    WHEN 'opened'    THEN 3
    WHEN 'clicked'   THEN 4
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.set_email_status_by_message_id(
  p_message_id text,
  p_status text DEFAULT NULL,
  p_event jsonb DEFAULT '{}'::jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_mid text; v_count int;
BEGIN
  v_mid := public.norm_message_id(p_message_id);
  IF v_mid IS NULL THEN RETURN 0; END IF;

  UPDATE public.email_log
     SET status = CASE
            WHEN p_status IS NULL THEN status
            -- failure/terminal events always win
            WHEN lower(p_status) IN ('bounced','blocked','spam','invalid','failed') THEN p_status
            -- unranked events (e.g. deferred) never change a ranked status
            WHEN public.email_status_rank(p_status) = 0 THEN status
            -- progression events only ever move forward
            WHEN public.email_status_rank(p_status) >= public.email_status_rank(status) THEN p_status
            ELSE status
          END,
         events     = events || p_event,
         updated_at = now()
   WHERE provider_message_id = v_mid;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
