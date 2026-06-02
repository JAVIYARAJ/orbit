-- ── 1. Add parent_task_id to tasks ──────────────────────────────────────────
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE;

-- ── 2. Rebuild create_task to persist parent_task_id ────────────────────────
CREATE OR REPLACE FUNCTION public.create_task(p_workstation_id uuid, p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_row tasks%rowtype;
BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM workstation_members
    WHERE workstation_id = p_workstation_id AND user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'access_denied'; END IF;

  INSERT INTO tasks(
    user_id, workstation_id, task_id, project_short_id, col,
    priority, title, due_date, est_hours, actual_hours,
    tags, subs_total, subs_done, parent_task_id
  ) VALUES (
    auth.uid(), p_workstation_id,
    p_data->>'task_id',
    p_data->>'project_short_id',
    coalesce(p_data->>'col', 'todo'),
    (p_data->>'priority')::int,
    p_data->>'title',
    nullif(p_data->>'due_date', '')::date,
    coalesce((p_data->>'est_hours')::numeric,  0),
    coalesce((p_data->>'actual_hours')::numeric, 0),
    (SELECT array_agg(x) FROM jsonb_array_elements_text(coalesce(p_data->'tags','[]')) x),
    coalesce((p_data->>'subs_total')::int, 0),
    coalesce((p_data->>'subs_done')::int,  0),
    nullif(p_data->>'parent_task_id', '')::uuid
  ) RETURNING * INTO v_row;

  RETURN row_to_json(v_row)::jsonb;
END;
$$;

-- ── 3. Rebuild update_task to persist parent_task_id ────────────────────────
CREATE OR REPLACE FUNCTION public.update_task(p_task_id text, p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_row tasks%rowtype;
BEGIN
  UPDATE tasks SET
    col            = coalesce(p_data->>'col', col),
    priority       = (p_data->>'priority')::int,
    title          = p_data->>'title',
    due_date       = nullif(p_data->>'due_date', '')::date,
    est_hours      = coalesce((p_data->>'est_hours')::numeric,  0),
    actual_hours   = coalesce((p_data->>'actual_hours')::numeric, 0),
    tags           = (SELECT array_agg(x) FROM jsonb_array_elements_text(coalesce(p_data->'tags','[]')) x),
    subs_total     = coalesce((p_data->>'subs_total')::int, 0),
    subs_done      = coalesce((p_data->>'subs_done')::int,  0),
    parent_task_id = CASE
      WHEN p_data ? 'parent_task_id'
      THEN nullif(p_data->>'parent_task_id', '')::uuid
      ELSE parent_task_id
    END
  WHERE task_id = p_task_id
    AND workstation_id IN (
      SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid()
    )
  RETURNING * INTO v_row;

  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  RETURN row_to_json(v_row)::jsonb;
END;
$$;
