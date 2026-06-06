-- ─── Update load_workstation_data to include task_priorities + use priority_id ──
CREATE OR REPLACE FUNCTION public.load_workstation_data(p_workstation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM workstation_members WHERE workstation_id = p_workstation_id AND user_id = auth.uid())
  THEN RAISE EXCEPTION 'access_denied'; END IF;

  RETURN jsonb_build_object(
    'task_priorities', (
      SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]')
      FROM (SELECT * FROM task_priorities WHERE workstation_id = p_workstation_id ORDER BY sort_order) r
    ),
    'statuses', (
      SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]')
      FROM (SELECT * FROM task_statuses WHERE workstation_id = p_workstation_id ORDER BY sort_order) r
    ),
    'project_types', (
      SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]')
      FROM (SELECT * FROM project_types WHERE workstation_id = p_workstation_id ORDER BY sort_order) r
    ),
    'tags', (
      SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]')
      FROM (SELECT * FROM tags WHERE workstation_id = p_workstation_id ORDER BY name) r
    ),
    'projects', (
      SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]')
      FROM (SELECT * FROM projects WHERE workstation_id = p_workstation_id ORDER BY created_at) r
    ),
    'tasks', (
      SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]')
      FROM (SELECT * FROM tasks WHERE workstation_id = p_workstation_id ORDER BY created_at) r
    ),
    'note_folders', (
      SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]')
      FROM (SELECT * FROM note_folders WHERE workstation_id = p_workstation_id ORDER BY sort_order, name) r
    ),
    'notes', (
      SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]')
      FROM (
        SELECT n.id, n.title, n.folder_id, nf.name AS folder_name,
               n.tags, n.pinned, n.body, n.created_at, n.updated_at
        FROM notes n
        LEFT JOIN note_folders nf ON nf.id = n.folder_id
        WHERE n.workstation_id = p_workstation_id AND n.deleted_at IS NULL
        ORDER BY n.pinned DESC, n.updated_at DESC
      ) r
    ),
    'vault', (
      SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]')
      FROM (SELECT * FROM vault WHERE workstation_id = p_workstation_id ORDER BY updated_at DESC) r
    ),
    'learning', (
      SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]')
      FROM (SELECT * FROM learning WHERE workstation_id = p_workstation_id ORDER BY created_at) r
    ),
    'email_templates', (
      SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]')
      FROM (SELECT * FROM email_templates WHERE workstation_id = p_workstation_id ORDER BY created_at) r
    ),
    'gantt_tasks', (
      SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]')
      FROM (
        SELECT id, project_id, name, sub, start_week, end_week, status, sort_order
        FROM gantt_tasks
        WHERE workstation_id = p_workstation_id
        ORDER BY sort_order
      ) r
    )
  );
END;
$function$;

-- ─── Update create_task to use priority_id ──────────────────────────
CREATE OR REPLACE FUNCTION public.create_task(p_workstation_id uuid, p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE v_row tasks%rowtype;
BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM workstation_members
    WHERE workstation_id = p_workstation_id AND user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'access_denied'; END IF;

  INSERT INTO tasks(
    user_id, workstation_id, task_id, project_short_id, status_id,
    priority_id, title, description, due_date, tag_ids, parent_task_id,
    est_minutes, gh_branch
  ) VALUES (
    auth.uid(), p_workstation_id,
    p_data->>'task_id',
    p_data->>'project_short_id',
    nullif(p_data->>'status_id', '')::uuid,
    nullif(p_data->>'priority_id', '')::uuid,
    p_data->>'title',
    coalesce(p_data->>'description', ''),
    nullif(p_data->>'due_date', '')::date,
    (SELECT array_agg(x::uuid) FROM jsonb_array_elements_text(coalesce(p_data->'tag_ids', '[]')) x),
    nullif(p_data->>'parent_task_id', '')::uuid,
    coalesce((p_data->>'est_minutes')::int, 0),
    nullif(p_data->>'gh_branch', '')
  ) RETURNING * INTO v_row;

  RETURN row_to_json(v_row)::jsonb;
END;
$function$;

-- ─── Update update_task to use priority_id ──────────────────────────
CREATE OR REPLACE FUNCTION public.update_task(p_task_id text, p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE
  v_row        tasks%rowtype;
  v_old_status uuid;
  v_new_status uuid;
  v_id         uuid;
BEGIN
  SELECT id, status_id
    INTO v_id, v_old_status
    FROM tasks
   WHERE task_id = p_task_id
     AND deleted_at IS NULL
     AND workstation_id IN (
       SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid()
     )
   LIMIT 1;

  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;

  UPDATE tasks SET
    status_id      = CASE
                       WHEN p_data ? 'status_id'
                       THEN nullif(p_data->>'status_id', '')::uuid
                       ELSE status_id
                     END,
    priority_id    = nullif(p_data->>'priority_id', '')::uuid,
    title          = p_data->>'title',
    description    = coalesce(p_data->>'description', description),
    due_date       = nullif(p_data->>'due_date', '')::date,
    tag_ids        = (SELECT array_agg(x::uuid) FROM jsonb_array_elements_text(coalesce(p_data->'tag_ids', '[]')) x),
    parent_task_id = CASE
                       WHEN p_data ? 'parent_task_id'
                       THEN nullif(p_data->>'parent_task_id', '')::uuid
                       ELSE parent_task_id
                     END,
    est_minutes    = CASE
                       WHEN p_data ? 'est_minutes'
                       THEN coalesce((p_data->>'est_minutes')::int, est_minutes)
                       ELSE est_minutes
                     END,
    gh_branch      = CASE
                       WHEN p_data ? 'gh_branch'
                       THEN nullif(p_data->>'gh_branch', '')
                       ELSE gh_branch
                     END,
    updated_at     = now()
  WHERE id = v_id
  RETURNING * INTO v_row;

  v_new_status := v_row.status_id;
  IF v_old_status IS DISTINCT FROM v_new_status THEN
    INSERT INTO public.task_status_logs (task_id, from_status_id, to_status_id, user_id)
    VALUES (v_row.id, v_old_status, v_new_status, auth.uid());
  END IF;

  RETURN row_to_json(v_row)::jsonb;
END;
$function$;

-- ─── CRUD RPC: create_task_priority ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_task_priority(p_workstation_id uuid, p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_row task_priorities%rowtype;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM workstation_members
    WHERE workstation_id = p_workstation_id AND user_id = auth.uid() AND role IN ('owner','admin'))
  THEN RAISE EXCEPTION 'access_denied'; END IF;

  INSERT INTO task_priorities(workstation_id, label, color, sort_order)
  VALUES (
    p_workstation_id,
    p_data->>'label',
    coalesce(p_data->>'color', '#888888'),
    coalesce((p_data->>'sort_order')::int, 999)
  ) RETURNING * INTO v_row;

  RETURN row_to_json(v_row)::jsonb;
END;
$function$;

-- ─── CRUD RPC: update_task_priority ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_task_priority(p_priority_id uuid, p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_row task_priorities%rowtype;
BEGIN
  UPDATE task_priorities SET
    label      = coalesce(p_data->>'label', label),
    color      = coalesce(p_data->>'color', color),
    sort_order = coalesce((p_data->>'sort_order')::int, sort_order)
  WHERE id = p_priority_id
    AND workstation_id IN (
      SELECT workstation_id FROM workstation_members
      WHERE user_id = auth.uid() AND role IN ('owner','admin')
    )
  RETURNING * INTO v_row;

  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  RETURN row_to_json(v_row)::jsonb;
END;
$function$;

-- ─── CRUD RPC: delete_task_priority ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_task_priority(p_priority_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM task_priorities
  WHERE id = p_priority_id
    AND workstation_id IN (
      SELECT workstation_id FROM workstation_members
      WHERE user_id = auth.uid() AND role IN ('owner','admin')
    );
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
END;
$function$;

-- ─── CRUD RPC: reorder_task_priorities ──────────────────────────────
CREATE OR REPLACE FUNCTION public.reorder_task_priorities(p_workstation_id uuid, p_ordered_ids jsonb)
RETURNS void LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE
  v_id  text;
  v_idx integer := 0;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM workstation_members
    WHERE workstation_id = p_workstation_id AND user_id = auth.uid() AND role IN ('owner','admin'))
  THEN RAISE EXCEPTION 'access_denied'; END IF;

  FOR v_id IN SELECT jsonb_array_elements_text(p_ordered_ids) LOOP
    UPDATE task_priorities SET sort_order = v_idx
    WHERE id = v_id::uuid AND workstation_id = p_workstation_id;
    v_idx := v_idx + 1;
  END LOOP;
END;
$function$;
