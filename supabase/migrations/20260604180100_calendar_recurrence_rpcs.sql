-- Wire recurrence + per-occurrence reminder timing through the calendar RPCs.

-- create: store recurrence_rule and arm reminder_next_at (first occurrence ≥ now).
CREATE OR REPLACE FUNCTION public.create_calendar_event(p_workstation_id uuid, p_data jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_row    calendar_events%rowtype;
  v_starts timestamptz := (p_data->>'starts_at')::timestamptz;
  v_rule   text := nullif(p_data->>'recurrence_rule','');
  v_remind int  := nullif(p_data->>'remind_minutes','')::int;
  v_next   timestamptz;
BEGIN
  IF NOT has_workspace_permission(p_workstation_id, 'manage_calendar')
  THEN RAISE EXCEPTION 'permission_denied'; END IF;

  IF v_remind IS NOT NULL THEN
    IF v_starts > now() THEN v_next := v_starts;
    ELSIF v_rule IS NOT NULL THEN v_next := calendar_next_occurrence(v_rule, v_starts, now());
    END IF;
  END IF;

  INSERT INTO calendar_events(workstation_id, title, description, location, starts_at, ends_at,
    all_day, color, project_short_id, remind_minutes, recurrence_rule, reminder_next_at, created_by, updated_by)
  VALUES (p_workstation_id, p_data->>'title', coalesce(p_data->>'description',''),
    nullif(p_data->>'location',''), v_starts, (p_data->>'ends_at')::timestamptz,
    coalesce((p_data->>'all_day')::boolean, false), nullif(p_data->>'color',''),
    nullif(p_data->>'project_short_id',''), v_remind, v_rule, v_next, auth.uid(), auth.uid())
  RETURNING * INTO v_row;
  RETURN row_to_json(v_row)::jsonb;
END;
$function$;

-- update: store recurrence_rule; re-arm reminder_next_at when time / recurrence /
-- reminder changes; flag the Google link for re-push.
CREATE OR REPLACE FUNCTION public.update_calendar_event(p_id uuid, p_data jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_row calendar_events%rowtype; v_ws uuid; v_next timestamptz;
BEGIN
  SELECT workstation_id INTO v_ws FROM calendar_events
   WHERE id = p_id AND deleted_at IS NULL
     AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid());
  IF v_ws IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT has_workspace_permission(v_ws, 'manage_calendar') THEN RAISE EXCEPTION 'permission_denied'; END IF;

  UPDATE calendar_events SET
    title            = coalesce(p_data->>'title', title),
    description      = coalesce(p_data->>'description', description),
    location         = CASE WHEN p_data ? 'location' THEN nullif(p_data->>'location','') ELSE location END,
    starts_at        = CASE WHEN p_data ? 'starts_at' THEN (p_data->>'starts_at')::timestamptz ELSE starts_at END,
    ends_at          = CASE WHEN p_data ? 'ends_at'   THEN (p_data->>'ends_at')::timestamptz   ELSE ends_at   END,
    all_day          = CASE WHEN p_data ? 'all_day'   THEN (p_data->>'all_day')::boolean        ELSE all_day   END,
    color            = CASE WHEN p_data ? 'color' THEN nullif(p_data->>'color','') ELSE color END,
    project_short_id = CASE WHEN p_data ? 'project_short_id' THEN nullif(p_data->>'project_short_id','') ELSE project_short_id END,
    remind_minutes   = CASE WHEN p_data ? 'remind_minutes' THEN nullif(p_data->>'remind_minutes','')::int ELSE remind_minutes END,
    recurrence_rule  = CASE WHEN p_data ? 'recurrence_rule' THEN nullif(p_data->>'recurrence_rule','') ELSE recurrence_rule END,
    updated_at = now(), updated_by = auth.uid()
  WHERE id = p_id
  RETURNING * INTO v_row;

  IF (p_data ? 'remind_minutes') OR (p_data ? 'starts_at') OR (p_data ? 'recurrence_rule') THEN
    IF v_row.remind_minutes IS NULL THEN v_next := NULL;
    ELSIF v_row.starts_at > now() THEN v_next := v_row.starts_at;
    ELSIF v_row.recurrence_rule IS NOT NULL THEN v_next := calendar_next_occurrence(v_row.recurrence_rule, v_row.starts_at, now());
    ELSE v_next := NULL; END IF;
    UPDATE calendar_events SET reminder_next_at = v_next WHERE id = v_row.id;
    v_row.reminder_next_at := v_next;
  END IF;

  UPDATE calendar_event_links SET sync_status = 'pending_push'
   WHERE workstation_id = v_row.workstation_id AND orbit_kind = 'event' AND orbit_id = v_row.id::text;

  RETURN row_to_json(v_row)::jsonb;
END;
$function$;

-- dispatcher: fire off reminder_next_at, then advance (recurring) or clear (one-off).
CREATE OR REPLACE FUNCTION public.dispatch_calendar_reminders()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT id, created_by, title, recurrence_rule, starts_at, reminder_next_at, remind_minutes
      FROM calendar_events
     WHERE deleted_at IS NULL
       AND reminder_next_at IS NOT NULL
       AND remind_minutes IS NOT NULL
       AND created_by IS NOT NULL
       AND now() >= reminder_next_at - make_interval(mins => remind_minutes)
       AND now() <= reminder_next_at + interval '1 minute'
  LOOP
    INSERT INTO notifications(id, user_id, actor_id, type, preview, created_at)
    VALUES (gen_random_uuid(), r.created_by, r.created_by, 'calendar_reminder',
      r.title || CASE WHEN r.remind_minutes <= 0 THEN ' is starting now'
                      ELSE ' starts in ' || r.remind_minutes || ' min' END,
      now());

    IF r.recurrence_rule IS NULL THEN
      UPDATE calendar_events SET reminder_next_at = NULL WHERE id = r.id;
    ELSE
      UPDATE calendar_events
         SET reminder_next_at = calendar_next_occurrence(r.recurrence_rule, r.starts_at, r.reminder_next_at)
       WHERE id = r.id;
    END IF;
  END LOOP;
END;
$function$;

-- read window: include recurring masters that recur into the window (FE expands them).
CREATE OR REPLACE FUNCTION public.list_calendar_window(p_workstation_id uuid, p_from timestamptz, p_to timestamptz)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_result jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM workstation_members WHERE workstation_id = p_workstation_id AND user_id = auth.uid())
  THEN RAISE EXCEPTION 'access_denied'; END IF;

  SELECT jsonb_build_object(
    'events', coalesce((SELECT jsonb_agg(to_jsonb(e)) FROM calendar_events e
        WHERE e.workstation_id = p_workstation_id AND e.deleted_at IS NULL
          AND ( (e.recurrence_rule IS NULL AND e.starts_at < p_to AND e.ends_at >= p_from)
                OR (e.recurrence_rule IS NOT NULL AND e.starts_at < p_to) )), '[]'::jsonb),
    'google', coalesce((SELECT jsonb_agg(to_jsonb(g)) FROM google_calendar_cache g
        WHERE g.workstation_id = p_workstation_id AND coalesce(g.status,'confirmed') <> 'cancelled'
          AND g.starts_at < p_to AND g.ends_at >= p_from), '[]'::jsonb),
    'tasks', coalesce((SELECT jsonb_agg(jsonb_build_object(
          'id', t.id, 'task_id', t.task_id, 'title', t.title, 'due_date', t.due_date,
          'project_short_id', t.project_short_id, 'status_id', t.status_id,
          'priority_id', t.priority_id, 'assignee_id', t.assignee_id))
        FROM tasks t WHERE t.workstation_id = p_workstation_id AND t.deleted_at IS NULL
          AND t.due_date IS NOT NULL AND t.due_date >= p_from::date AND t.due_date <= p_to::date), '[]'::jsonb),
    'projects', coalesce((SELECT jsonb_agg(jsonb_build_object(
          'id', p.id, 'short_id', p.short_id, 'name', p.name, 'status', p.status,
          'start_date', p.start_date, 'end_date', p.end_date))
        FROM projects p WHERE p.workstation_id = p_workstation_id AND p.deleted_at IS NULL
          AND p.start_date IS NOT NULL
          AND p.start_date <= p_to::date AND coalesce(p.end_date, p.start_date) >= p_from::date), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$function$;

-- push: carry recurrence_rule so the proxy can set Google's recurrence array.
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
           e.starts_at, e.ends_at, e.all_day, e.recurrence_rule, e.updated_at
      FROM calendar_events e
     WHERE e.workstation_id = p_workstation_id AND e.deleted_at IS NULL
       AND coalesce((SELECT push_event FROM prefs), true)
    UNION ALL
    SELECT 'task', t.task_id, t.title, coalesce(t.description,''), NULL,
           t.due_date::timestamptz, t.due_date::timestamptz, true, NULL, t.updated_at
      FROM tasks t
     WHERE t.workstation_id = p_workstation_id AND t.deleted_at IS NULL AND t.due_date IS NOT NULL
       AND coalesce((SELECT push_task FROM prefs), true)
    UNION ALL
    SELECT 'project', p.short_id, p.name, coalesce(p.description,''), NULL,
           p.start_date::timestamptz, (coalesce(p.end_date, p.start_date) + 1)::timestamptz, true, NULL, p.updated_at
      FROM projects p
     WHERE p.workstation_id = p_workstation_id AND p.deleted_at IS NULL AND p.start_date IS NOT NULL
       AND coalesce((SELECT push_project FROM prefs), true)
  )
  SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
    SELECT jsonb_build_object(
             'kind', ci.kind, 'orbit_id', ci.orbit_id, 'title', ci.title,
             'description', ci.description, 'location', ci.location,
             'starts_at', ci.starts_at, 'ends_at', ci.ends_at, 'all_day', ci.all_day,
             'recurrence_rule', ci.recurrence_rule, 'orbit_updated_at', ci.updated_at,
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