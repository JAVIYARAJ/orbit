-- Bulk email logging: insert many email_log rows in one call (used by the
-- broadcast sender so logging a 1000-recipient chunk is a single round-trip).

CREATE OR REPLACE FUNCTION public.log_emails_bulk(p_rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_count int;
BEGIN
  INSERT INTO public.email_log (kind, to_email, subject, status, reason, related_id, provider_message_id)
  SELECT x.kind, x.to_email, x.subject, x.status, x.reason,
         nullif(x.related_id, '')::uuid,
         public.norm_message_id(x.provider_message_id)
  FROM jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) AS x(
    kind text, to_email text, subject text, status text, reason text,
    related_id text, provider_message_id text
  );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_emails_bulk(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_emails_bulk(jsonb) TO service_role;
