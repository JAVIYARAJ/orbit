-- ── 1. Add time columns to tasks ──────────────────────────────────
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS est_minutes    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS logged_minutes integer NOT NULL DEFAULT 0;

-- ── 2. Add is_manual flag to time_entries ─────────────────────────
ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS is_manual boolean NOT NULL DEFAULT false;

-- ── 3. Update create_task — handle est_minutes ────────────────────
CREATE OR REPLACE FUNCTION public.create_task(
  p_workstation_id uuid,
  p_data           jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_row tasks%rowtype;
BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM workstation_members
    WHERE workstation_id = p_workstation_id AND user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'access_denied'; END IF;

  INSERT INTO tasks(
    user_id, workstation_id, task_id, project_short_id, status_id,
    priority, title, description, due_date, tag_ids, parent_task_id,
    est_minutes
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
    coalesce((p_data->>'est_minutes')::int, 0)
  ) RETURNING * INTO v_row;

  RETURN row_to_json(v_row)::jsonb;
END;
$$;

-- ── 4. Update update_task — handle est_minutes ────────────────────
CREATE OR REPLACE FUNCTION public.update_task(
  p_task_id text,
  p_data    jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
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

-- ── 5. Update complete_time_entry — also roll up task logged_minutes
CREATE OR REPLACE FUNCTION public.complete_time_entry(
  p_entry_id        uuid,
  p_elapsed_seconds integer DEFAULT 0,
  p_notes           text    DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_total   integer;
  v_pid     uuid;
  v_task_id uuid;
BEGIN
  UPDATE public.time_entries
  SET status        = 'completed',
      total_seconds = total_seconds + p_elapsed_seconds,
      notes         = p_notes,
      ended_at      = now()
  WHERE id = p_entry_id AND user_id = auth.uid()
  RETURNING total_seconds, project_id, task_id INTO v_total, v_pid, v_task_id;

  INSERT INTO public.time_entry_events (entry_id, event, elapsed_seconds)
  VALUES (p_entry_id, 'complete', p_elapsed_seconds);

  UPDATE public.projects
  SET hours_logged = COALESCE(hours_logged, 0) + ROUND(v_total::numeric / 3600, 4)
  WHERE id = v_pid;

  IF v_task_id IS NOT NULL THEN
    UPDATE public.tasks
    SET logged_minutes = COALESCE(logged_minutes, 0) + CEIL(v_total::numeric / 60)
    WHERE id = v_task_id;
  END IF;

  RETURN public.te_json(p_entry_id);
END; $$;

-- ── 6. New RPC: log_manual_time ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_manual_time(
  p_workstation_id uuid,
  p_project_id     uuid,
  p_task_id        uuid,
  p_minutes        integer,
  p_notes          text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_seconds integer := p_minutes * 60;
  v_id      uuid;
BEGIN
  INSERT INTO public.time_entries (
    workstation_id, user_id, project_id, task_id,
    status, total_seconds, notes, is_manual, ended_at
  ) VALUES (
    p_workstation_id, auth.uid(), p_project_id, p_task_id,
    'completed', v_seconds, p_notes, true, now()
  ) RETURNING id INTO v_id;

  INSERT INTO public.time_entry_events (entry_id, event, elapsed_seconds)
  VALUES (v_id, 'complete', v_seconds);

  UPDATE public.projects
  SET hours_logged = COALESCE(hours_logged, 0) + ROUND(v_seconds::numeric / 3600, 4)
  WHERE id = p_project_id;

  IF p_task_id IS NOT NULL THEN
    UPDATE public.tasks
    SET logged_minutes = COALESCE(logged_minutes, 0) + p_minutes
    WHERE id = p_task_id;
  END IF;

  RETURN public.te_json(v_id);
END; $$;
