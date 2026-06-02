-- Remove col from create_task (status_id only)
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
    priority, title, description, due_date, est_hours, actual_hours,
    tags, parent_task_id
  ) VALUES (
    auth.uid(), p_workstation_id,
    p_data->>'task_id',
    p_data->>'project_short_id',
    nullif(p_data->>'status_id', '')::uuid,
    (p_data->>'priority')::int,
    p_data->>'title',
    coalesce(p_data->>'description', ''),
    nullif(p_data->>'due_date', '')::date,
    coalesce((p_data->>'est_hours')::numeric, 0),
    coalesce((p_data->>'actual_hours')::numeric, 0),
    (SELECT array_agg(x) FROM jsonb_array_elements_text(coalesce(p_data->'tags','[]')) x),
    nullif(p_data->>'parent_task_id', '')::uuid
  ) RETURNING * INTO v_row;

  RETURN row_to_json(v_row)::jsonb;
END;
$$;

-- Remove col from update_task (status_id only)
CREATE OR REPLACE FUNCTION public.update_task(p_task_id text, p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_row tasks%rowtype;
BEGIN
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
    est_hours      = coalesce((p_data->>'est_hours')::numeric, 0),
    actual_hours   = coalesce((p_data->>'actual_hours')::numeric, 0),
    tags           = (SELECT array_agg(x) FROM jsonb_array_elements_text(coalesce(p_data->'tags','[]')) x),
    parent_task_id = CASE
                       WHEN p_data ? 'parent_task_id'
                       THEN nullif(p_data->>'parent_task_id', '')::uuid
                       ELSE parent_task_id
                     END,
    updated_at     = now()
  WHERE task_id = p_task_id
    AND workstation_id IN (
      SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid()
    )
  RETURNING * INTO v_row;

  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  RETURN row_to_json(v_row)::jsonb;
END;
$$;

-- Drop the old text col column
ALTER TABLE tasks DROP COLUMN IF EXISTS col;
