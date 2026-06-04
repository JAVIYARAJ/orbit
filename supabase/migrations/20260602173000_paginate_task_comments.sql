-- Paginate task comments server-side: return the latest p_limit top-level comments
-- (newest first) plus their replies, and the total top-level count so the client can
-- decide whether to show "Show more comments". Replaces the previous fetch-all version.
CREATE OR REPLACE FUNCTION public.get_task_comments(p_task_id uuid, p_limit integer DEFAULT 10, p_offset integer DEFAULT 0)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_total integer; v_comments jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM tasks t
    JOIN workstation_members wm ON wm.workstation_id = t.workstation_id
    WHERE t.id = p_task_id AND wm.user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'access_denied'; END IF;

  SELECT count(*) INTO v_total
  FROM task_comments
  WHERE task_id = p_task_id AND deleted_at IS NULL AND parent_id IS NULL;

  WITH parents AS (
    SELECT id FROM task_comments
    WHERE task_id = p_task_id AND deleted_at IS NULL AND parent_id IS NULL
    ORDER BY created_at DESC
    LIMIT GREATEST(p_limit, 1) OFFSET GREATEST(p_offset, 0)
  ),
  page AS (
    SELECT c.* FROM task_comments c
    WHERE c.task_id = p_task_id AND c.deleted_at IS NULL
      AND (c.id IN (SELECT id FROM parents) OR c.parent_id IN (SELECT id FROM parents))
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',             c.id,
      'parentId',       c.parent_id,
      'userId',         c.user_id,
      'authorName',     COALESCE(p.name, p.email, 'Unknown'),
      'authorAvatar',   COALESCE(LEFT(p.name, 1), LEFT(p.email, 1), '?'),
      'authorAvatarUrl',p.avatar_url,
      'body',           c.body,
      'createdAt',      c.created_at,
      'editedAt',       c.edited_at
    ) ORDER BY c.created_at ASC
  ), '[]'::jsonb)
  INTO v_comments
  FROM page c
  LEFT JOIN profiles p ON p.id = c.user_id;

  RETURN jsonb_build_object('comments', v_comments, 'total', v_total);
END;
$function$;
