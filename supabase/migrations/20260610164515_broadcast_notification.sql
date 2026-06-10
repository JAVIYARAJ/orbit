-- Broadcast in-app notification: insert one notification for every user in a
-- single set-based statement. Modelled as a system notification (actor = self),
-- matching the convention used by notify() for actor-less events.

CREATE OR REPLACE FUNCTION public.broadcast_notification(
  p_title text,
  p_preview text,
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
  FROM public.profiles p;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.broadcast_notification(text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.broadcast_notification(text, text, text, jsonb) TO service_role;
