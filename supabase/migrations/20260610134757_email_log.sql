-- Unified email audit log + delivery tracking.
--
-- email_log holds one row per send attempt (welcome, contact reply, …) and is
-- written ONLY through the log_email() RPC. Delivery status (delivered, bounced,
-- blocked, spam, …) is updated from Brevo webhook events via
-- set_email_status_by_message_id(). No direct table writes from app code.

CREATE TABLE IF NOT EXISTS public.email_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        text NOT NULL,                        -- 'welcome' | 'contact_reply'
  to_email    text NOT NULL,
  subject     text,
  status      text NOT NULL,                        -- sent | delivered | bounced | blocked | spam | invalid | deferred | failed | skipped
  reason      text,                                 -- 'signup' | 'admin_reply' | 'already_sent' | 'disabled' | error detail
  related_id  uuid,                                 -- profile id / submission id
  provider_message_id text,                         -- Brevo message-id (angle brackets stripped)
  events      jsonb NOT NULL DEFAULT '[]'::jsonb,   -- raw provider events appended over time
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;
-- No policies: reached only via the service-role admin Edge Function / RPCs.

CREATE INDEX IF NOT EXISTS idx_email_log_created_at ON public.email_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_log_kind ON public.email_log(kind);
CREATE INDEX IF NOT EXISTS idx_email_log_status ON public.email_log(status);
CREATE INDEX IF NOT EXISTS idx_email_log_message_id ON public.email_log(provider_message_id);

-- Normalise a provider message id (drop angle brackets, empty -> null).
CREATE OR REPLACE FUNCTION public.norm_message_id(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$ SELECT nullif(replace(replace(coalesce(p, ''), '<', ''), '>', ''), ''); $$;

-- Insert a log row. Called by the Edge Functions on every send attempt.
CREATE OR REPLACE FUNCTION public.log_email(
  p_kind text,
  p_to_email text,
  p_subject text,
  p_status text,
  p_reason text DEFAULT NULL,
  p_related_id uuid DEFAULT NULL,
  p_provider_message_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.email_log (kind, to_email, subject, status, reason, related_id, provider_message_id)
  VALUES (p_kind, p_to_email, p_subject, p_status, p_reason, p_related_id,
          public.norm_message_id(p_provider_message_id))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Update delivery status from a provider event (matched by message id).
-- p_status NULL leaves the current status unchanged (e.g. for engagement-only events).
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
     SET status     = coalesce(p_status, status),
         events     = events || p_event,
         updated_at = now()
   WHERE provider_message_id = v_mid;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Lock down: only the service-role (Edge Functions) may execute these.
REVOKE EXECUTE ON FUNCTION public.log_email(text, text, text, text, text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_email_status_by_message_id(text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_email(text, text, text, text, text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_email_status_by_message_id(text, text, jsonb) TO service_role;
