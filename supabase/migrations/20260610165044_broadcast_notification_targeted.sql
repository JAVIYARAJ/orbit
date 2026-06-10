-- Allow the broadcast notification to target a specific set of users.
-- p_user_ids NULL/empty => all users; otherwise only the listed ids.
-- Drop the old 4-arg version first so named-arg calls aren't ambiguous.

DROP FUNCTION IF EXISTS public.broadcast_notification(text, text, text, jsonb);

CREATE OR REPLACE FUNCTION public.broadcast_notification(
  p_title text,
  p_preview text,
  p_user_ids uuid[] DEFAULT NULL,
  p_type text DEFAULT 'broadcast',
  p_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_count int;
BEGIN
  INSERT INTO public.notifications (user_id, actor_id, type, entity_type, title, preview, meta)
  SELECT p.id, p.id, p_type, 'broadcast', p_title, p_preview, coalesce(p_meta, '{}'::jsonb)
  FROM public.profiles p
  WHERE p_user_ids IS NULL OR cardinality(p_user_ids) = 0 OR p.id = ANY(p_user_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.broadcast_notification(text, text, uuid[], text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.broadcast_notification(text, text, uuid[], text, jsonb) TO service_role;
