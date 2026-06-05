-- get_notifications now returns generic linking fields so every notification
-- type can render + navigate. Falls back to the tasks join for legacy rows.
CREATE OR REPLACE FUNCTION public.get_notifications(p_limit integer DEFAULT 30)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id',            n.id,
        'type',          n.type,
        'readAt',        n.read_at,
        'createdAt',     n.created_at,
        'actorName',     COALESCE(pa.name, pa.email, 'Unknown'),
        'actorAvatarUrl',pa.avatar_url,
        'workstationId', n.workstation_id,
        'entityType',    COALESCE(n.entity_type, CASE WHEN n.task_id IS NOT NULL THEN 'task' END),
        'entityId',      COALESCE(n.entity_id, n.task_id::text),
        'title',         COALESCE(n.title, t.title),
        'meta',          COALESCE(n.meta, '{}'::jsonb),
        'taskTitle',     t.title,
        'taskDbId',      COALESCE(t.id::text, CASE WHEN n.entity_type = 'task' THEN n.entity_id END),
        'commentId',     n.comment_id,
        'preview',       n.preview
      ) ORDER BY n.created_at DESC
    ),
    '[]'::jsonb
  )
  FROM public.notifications n
  LEFT JOIN public.profiles pa ON pa.id = n.actor_id
  LEFT JOIN public.tasks    t  ON t.id  = n.task_id
  WHERE n.user_id = auth.uid()
  LIMIT p_limit;
$function$;
