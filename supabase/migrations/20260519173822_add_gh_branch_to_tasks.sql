-- 1. Add column
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS gh_branch text DEFAULT NULL;

-- 2. Recreate create_task to include gh_branch
CREATE OR REPLACE FUNCTION public.create_task(p_workstation_id uuid, p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_row tasks%rowtype;
BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM workstation_members
    WHERE workstation_id = p_workstation_id AND user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'access_denied'; END IF;

  INSERT INTO tasks(
    user_id, workstation_id, task_id, project_short_id, status_id,
    priority, title, description, due_date, tag_ids, parent_task_id,
    est_minutes, gh_branch
  ) VALUES (
    auth.uid(), p_workstation_id,
    p_data->>'task_id',
    p_data->>'project_short_id',
    nullif(p_data->>'status_id', '')::uuid,
    (p_data->>'priority')::int,
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
$$;

-- 3. Recreate update_task to include gh_branch
CREATE OR REPLACE FUNCTION public.update_task(p_task_id text, p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_row        tasks%rowtype;
  v_old_status uuid;
  v_new_status uuid;
BEGIN
  SELECT status_id INTO v_old_status FROM tasks WHERE task_id = p_task_id;

  UPDATE tasks SET
    status_id      = CASE
                       WHEN p_data ? 'status_id'
                       THEN nullif(p_data->>'status_id', '')::uuid
                       ELSE status_id
                     END,
    priority       = (p_data->>'priority')::int,
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
  WHERE task_id = p_task_id
    AND workstation_id IN (
      SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid()
    )
  RETURNING * INTO v_row;

  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;

  v_new_status := v_row.status_id;
  IF v_old_status IS DISTINCT FROM v_new_status THEN
    INSERT INTO public.task_status_logs (task_id, from_status_id, to_status_id, user_id)
    VALUES (v_row.id, v_old_status, v_new_status, auth.uid());
  END IF;

  RETURN row_to_json(v_row)::jsonb;
END;
$$;
