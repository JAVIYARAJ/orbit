-- 1. Add sort_order column
ALTER TABLE note_folders ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- 2. Set initial sort_order from current alphabetical order per workstation
UPDATE note_folders nf
SET sort_order = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY workstation_id ORDER BY name) AS rn
  FROM note_folders
) sub
WHERE nf.id = sub.id;

-- 3. RPC: reorder folders by passing ordered array of IDs
CREATE OR REPLACE FUNCTION public.reorder_note_folders(p_workstation_id uuid, p_folder_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM workstation_members
    WHERE workstation_id = p_workstation_id AND user_id = auth.uid())
  THEN RAISE EXCEPTION 'access_denied'; END IF;

  UPDATE note_folders nf
  SET sort_order = idx.ord
  FROM (
    SELECT unnest(p_folder_ids) AS id,
           generate_series(1, array_length(p_folder_ids, 1)) AS ord
  ) idx
  WHERE nf.id = idx.id AND nf.workstation_id = p_workstation_id;
END;
$$;

-- 4. Fix load_workstation_data to order note_folders by sort_order
CREATE OR REPLACE FUNCTION public.load_workstation_data(p_workstation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM workstation_members WHERE workstation_id = p_workstation_id AND user_id = auth.uid())
  THEN RAISE EXCEPTION 'access_denied'; END IF;

  RETURN jsonb_build_object(
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
      FROM (SELECT * FROM gantt_tasks WHERE workstation_id = p_workstation_id ORDER BY sort_order) r
    ),
    'timer_sessions', (
      SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]')
      FROM (SELECT * FROM timer_sessions WHERE workstation_id = p_workstation_id ORDER BY created_at) r
    )
  );
END;
$$;
