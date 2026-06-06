-- Per-workspace control over which Orbit item kinds are pushed to Google.
-- Stored in workspace_integrations.metadata->'push' as { event, task, project }
-- (booleans; missing/null = enabled). get_pending_pushes honours it: disabled
-- kinds stop pushing AND their existing Google events are removed (their links
-- become orphaned, so the delete branch cleans them up).

CREATE OR REPLACE FUNCTION public.set_google_sync_prefs(p_workstation_id uuid, p_prefs jsonb)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT has_workspace_permission(p_workstation_id, 'manage_calendar')
  THEN RAISE EXCEPTION 'permission_denied'; END IF;

  UPDATE workspace_integrations
     SET metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{push}', coalesce(p_prefs, '{}'::jsonb)),
         updated_at = now()
   WHERE workstation_id = p_workstation_id AND provider = 'google_calendar';
END;
$function$;

GRANT EXECUTE ON FUNCTION public.set_google_sync_prefs(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_pending_pushes(p_workstation_id uuid)
 RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH prefs AS (
    SELECT
      coalesce((metadata->'push'->>'event')::boolean,   true) AS push_event,
      coalesce((metadata->'push'->>'task')::boolean,    true) AS push_task,
      coalesce((metadata->'push'->>'project')::boolean, true) AS push_project
    FROM workspace_integrations
    WHERE workstation_id = p_workstation_id AND provider = 'google_calendar'
  ),
  current_items AS (
    SELECT 'event'::text AS kind, e.id::text AS orbit_id, e.title, e.description, e.location,
           e.starts_at, e.ends_at, e.all_day, e.updated_at
      FROM calendar_events e
     WHERE e.workstation_id = p_workstation_id AND e.deleted_at IS NULL
       AND coalesce((SELECT push_event FROM prefs), true)
    UNION ALL
    SELECT 'task', t.task_id, t.title, coalesce(t.description,''), NULL,
           t.due_date::timestamptz, t.due_date::timestamptz, true, t.updated_at
      FROM tasks t
     WHERE t.workstation_id = p_workstation_id AND t.deleted_at IS NULL AND t.due_date IS NOT NULL
       AND coalesce((SELECT push_task FROM prefs), true)
    UNION ALL
    SELECT 'project', p.short_id, p.name, coalesce(p.description,''), NULL,
           p.start_date::timestamptz, (coalesce(p.end_date, p.start_date) + 1)::timestamptz, true, p.updated_at
      FROM projects p
     WHERE p.workstation_id = p_workstation_id AND p.deleted_at IS NULL AND p.start_date IS NOT NULL
       AND coalesce((SELECT push_project FROM prefs), true)
  )
  SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
    SELECT jsonb_build_object(
             'kind', ci.kind, 'orbit_id', ci.orbit_id, 'title', ci.title,
             'description', ci.description, 'location', ci.location,
             'starts_at', ci.starts_at, 'ends_at', ci.ends_at, 'all_day', ci.all_day,
             'orbit_updated_at', ci.updated_at,
             'google_event_id', l.google_event_id, 'google_calendar_id', coalesce(l.google_calendar_id,'primary'),
             'etag', l.etag, 'deleted', false) AS item
      FROM current_items ci
      LEFT JOIN calendar_event_links l
        ON l.workstation_id = p_workstation_id AND l.orbit_kind = ci.kind AND l.orbit_id = ci.orbit_id
     WHERE l.id IS NULL
        OR l.orbit_updated_at IS DISTINCT FROM ci.updated_at
        OR l.sync_status IN ('pending_push','error')
    UNION ALL
    SELECT jsonb_build_object(
             'kind', l.orbit_kind, 'orbit_id', l.orbit_id,
             'google_event_id', l.google_event_id, 'google_calendar_id', l.google_calendar_id,
             'etag', l.etag, 'deleted', true) AS item
      FROM calendar_event_links l
      LEFT JOIN current_items ci ON ci.kind = l.orbit_kind AND ci.orbit_id = l.orbit_id
     WHERE l.workstation_id = p_workstation_id
       AND (l.sync_status = 'deleted' OR ci.orbit_id IS NULL)
  ) rows;
$function$;
