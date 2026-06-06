-- Helper: returns a note row joined with folder_name
CREATE OR REPLACE FUNCTION public._note_to_json(p_note_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE
SET search_path TO 'public'
AS $$
  SELECT row_to_json(r)::jsonb FROM (
    SELECT n.id, n.title, n.folder_id, nf.name AS folder_name,
           n.tags, n.pinned, n.body, n.created_at, n.updated_at
    FROM notes n
    LEFT JOIN note_folders nf ON nf.id = n.folder_id
    WHERE n.id = p_note_id
  ) r;
$$;

-- ── create_note ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_note(p_workstation_id uuid, p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_id        uuid;
  v_folder_id uuid;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM workstation_members
    WHERE workstation_id = p_workstation_id AND user_id = auth.uid())
  THEN RAISE EXCEPTION 'access_denied'; END IF;

  -- Resolve folder_id: use supplied id, else find/create 'Other'
  IF p_data->>'folder_id' IS NOT NULL THEN
    v_folder_id := (p_data->>'folder_id')::uuid;
  ELSE
    INSERT INTO note_folders (workstation_id, name)
    VALUES (p_workstation_id, 'Other')
    ON CONFLICT (workstation_id, name) DO NOTHING;
    SELECT id INTO v_folder_id FROM note_folders
    WHERE workstation_id = p_workstation_id AND name = 'Other';
  END IF;

  INSERT INTO notes(user_id, workstation_id, title, folder_id, tags, pinned, body)
  VALUES (
    auth.uid(), p_workstation_id,
    p_data->>'title', v_folder_id,
    (SELECT array_agg(x) FROM jsonb_array_elements_text(coalesce(p_data->'tags','[]')) x),
    coalesce((p_data->>'pinned')::boolean, false),
    coalesce(p_data->>'body','')
  ) RETURNING id INTO v_id;

  RETURN public._note_to_json(v_id);
END;
$$;

-- ── update_note ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_note(p_note_id uuid, p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE notes SET
    title     = p_data->>'title',
    folder_id = CASE WHEN p_data->>'folder_id' IS NOT NULL
                     THEN (p_data->>'folder_id')::uuid
                     ELSE folder_id END,
    tags      = (SELECT array_agg(x) FROM jsonb_array_elements_text(coalesce(p_data->'tags','[]')) x),
    pinned    = coalesce((p_data->>'pinned')::boolean, pinned),
    body      = coalesce(p_data->>'body', body)
  WHERE id = p_note_id
    AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid());
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  RETURN public._note_to_json(p_note_id);
END;
$$;

-- ── restore_note ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.restore_note(p_note_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE notes
  SET deleted_at = NULL, updated_at = now()
  WHERE id = p_note_id
    AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid())
    AND deleted_at IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  RETURN public._note_to_json(p_note_id);
END;
$$;

-- ── get_deleted_notes ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_deleted_notes(p_workstation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM workstation_members WHERE workstation_id = p_workstation_id AND user_id = auth.uid())
  THEN RAISE EXCEPTION 'access_denied'; END IF;

  RETURN COALESCE(
    (SELECT jsonb_agg(row_to_json(r)::jsonb)
     FROM (
       SELECT n.id, n.title, n.folder_id, nf.name AS folder_name,
              n.tags, n.pinned, n.body, n.created_at, n.updated_at, n.deleted_at
       FROM notes n
       LEFT JOIN note_folders nf ON nf.id = n.folder_id
       WHERE n.workstation_id = p_workstation_id AND n.deleted_at IS NOT NULL
       ORDER BY n.deleted_at DESC
     ) r),
    '[]'::jsonb
  );
END;
$$;

-- ── load_workstation_data — add note_folders, fix notes join ─────────
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
      FROM (SELECT * FROM note_folders WHERE workstation_id = p_workstation_id ORDER BY name) r
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

-- ── Folder CRUD ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_note_folder(p_workstation_id uuid, p_name text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE v_row note_folders%rowtype;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM workstation_members WHERE workstation_id = p_workstation_id AND user_id = auth.uid())
  THEN RAISE EXCEPTION 'access_denied'; END IF;

  INSERT INTO note_folders(workstation_id, name)
  VALUES (p_workstation_id, p_name)
  ON CONFLICT (workstation_id, name) DO NOTHING
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    SELECT * INTO v_row FROM note_folders
    WHERE workstation_id = p_workstation_id AND name = p_name;
  END IF;
  RETURN row_to_json(v_row)::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION public.rename_note_folder(p_folder_id uuid, p_name text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE v_row note_folders%rowtype;
BEGIN
  UPDATE note_folders SET name = p_name
  WHERE id = p_folder_id
    AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid())
  RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  RETURN row_to_json(v_row)::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_note_folder(p_folder_id uuid, p_workstation_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE v_other_id uuid;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM workstation_members WHERE workstation_id = p_workstation_id AND user_id = auth.uid())
  THEN RAISE EXCEPTION 'access_denied'; END IF;

  -- Ensure 'Other' folder exists to receive orphaned notes
  INSERT INTO note_folders (workstation_id, name)
  VALUES (p_workstation_id, 'Other')
  ON CONFLICT (workstation_id, name) DO NOTHING;
  SELECT id INTO v_other_id FROM note_folders WHERE workstation_id = p_workstation_id AND name = 'Other';

  -- Move notes to Other (unless deleting Other itself — not allowed)
  IF p_folder_id = v_other_id THEN
    RAISE EXCEPTION 'cannot_delete_other';
  END IF;

  UPDATE notes SET folder_id = v_other_id WHERE folder_id = p_folder_id;
  DELETE FROM note_folders WHERE id = p_folder_id;
END;
$$;
