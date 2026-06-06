-- Expose created_by/updated_by/deleted_by through the read paths that use explicit
-- column lists (the SELECT * loaders already include them). Backend wiring for the
-- deferred attribution UI.

CREATE OR REPLACE FUNCTION public._note_to_json(p_note_id uuid)
 RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
  SELECT row_to_json(r)::jsonb FROM (
    SELECT n.id, n.title, n.folder_id, nf.name AS folder_name,
           n.tags, n.pinned, n.body, n.created_at, n.updated_at,
           n.created_by, n.updated_by, n.deleted_by
    FROM notes n
    LEFT JOIN note_folders nf ON nf.id = n.folder_id
    WHERE n.id = p_note_id
  ) r;
$function$;

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
               n.tags, n.pinned, n.body, n.created_at, n.updated_at,
               n.created_by, n.updated_by, n.deleted_by
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
        SELECT id, project_id, name, sub, start_week, end_week, status, sort_order,
               created_by, updated_by, deleted_by
        FROM gantt_tasks
        WHERE workstation_id = p_workstation_id
        ORDER BY sort_order
      ) r
    )
  );
END;
$function$;
