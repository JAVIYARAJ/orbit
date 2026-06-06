-- Full notification module: generic linking columns + a central notify() helper
-- that every domain RPC can call. Self-suppresses (never notify the actor) and
-- supports system notifications (no human actor).

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS workstation_id uuid,
  ADD COLUMN IF NOT EXISTS entity_type    text,
  ADD COLUMN IF NOT EXISTS entity_id      text,
  ADD COLUMN IF NOT EXISTS title          text,
  ADD COLUMN IF NOT EXISTS meta           jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON notifications (user_id, read_at);

-- Insert one notification. actor optional (system events). Skips self-notifications.
CREATE OR REPLACE FUNCTION public.notify(
  p_user uuid, p_actor uuid, p_type text, p_workstation_id uuid,
  p_entity_type text, p_entity_id text, p_title text, p_preview text,
  p_meta jsonb DEFAULT '{}'::jsonb)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF p_user IS NULL THEN RETURN; END IF;
  IF p_actor IS NOT NULL AND p_actor = p_user THEN RETURN; END IF;   -- self-suppress

  INSERT INTO notifications(id, user_id, actor_id, type, workstation_id,
    entity_type, entity_id, title, preview, meta, created_at)
  VALUES (gen_random_uuid(), p_user, coalesce(p_actor, p_user), p_type, p_workstation_id,
    p_entity_type, p_entity_id, p_title, p_preview, coalesce(p_meta, '{}'::jsonb), now());
END;
$function$;

-- Fan-out to a set of recipients (distinct, actor excluded by notify()).
CREATE OR REPLACE FUNCTION public.notify_many(
  p_users uuid[], p_actor uuid, p_type text, p_workstation_id uuid,
  p_entity_type text, p_entity_id text, p_title text, p_preview text,
  p_meta jsonb DEFAULT '{}'::jsonb)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE u uuid;
BEGIN
  FOR u IN SELECT DISTINCT x FROM unnest(coalesce(p_users, '{}')) x WHERE x IS NOT NULL LOOP
    PERFORM notify(u, p_actor, p_type, p_workstation_id, p_entity_type, p_entity_id, p_title, p_preview, p_meta);
  END LOOP;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.notify(uuid,uuid,text,uuid,text,text,text,text,jsonb) FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_many(uuid[],uuid,text,uuid,text,text,text,text,jsonb) FROM public, authenticated;
