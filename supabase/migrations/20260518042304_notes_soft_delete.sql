-- 1. Add deleted_at column
ALTER TABLE notes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Soft-delete instead of hard delete
CREATE OR REPLACE FUNCTION public.delete_note(p_note_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  UPDATE notes
  SET deleted_at = now()
  WHERE id = p_note_id
    AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid())
    AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
END;
$$;

-- 3. Restore a soft-deleted note
CREATE OR REPLACE FUNCTION public.restore_note(p_note_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE result jsonb;
BEGIN
  UPDATE notes
  SET deleted_at = NULL, updated_at = now()
  WHERE id = p_note_id
    AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid())
    AND deleted_at IS NOT NULL
  RETURNING row_to_json(notes.*)::jsonb INTO result;
  IF result IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  RETURN result;
END;
$$;

-- 4. Permanently delete a note from trash
CREATE OR REPLACE FUNCTION public.purge_note(p_note_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM notes
  WHERE id = p_note_id
    AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid())
    AND deleted_at IS NOT NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
END;
$$;

-- 5. Fetch soft-deleted notes for a workstation
CREATE OR REPLACE FUNCTION public.get_deleted_notes(p_workstation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM workstation_members WHERE workstation_id = p_workstation_id AND user_id = auth.uid())
  THEN RAISE EXCEPTION 'access_denied'; END IF;

  RETURN COALESCE(
    (SELECT jsonb_agg(row_to_json(r)::jsonb)
     FROM (SELECT * FROM notes WHERE workstation_id = p_workstation_id AND deleted_at IS NOT NULL ORDER BY deleted_at DESC) r),
    '[]'::jsonb
  );
END;
$$;

-- 6. Exclude soft-deleted notes from load_workstation_data
CREATE OR REPLACE FUNCTION public.load_workstation_data(p_workstation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    'notes', (
      SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]')
      FROM (SELECT * FROM notes WHERE workstation_id = p_workstation_id AND deleted_at IS NULL ORDER BY pinned DESC, updated_at DESC) r
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
$function$;
