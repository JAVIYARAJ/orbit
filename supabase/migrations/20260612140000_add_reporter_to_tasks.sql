-- Reporter on tasks: who filed/owns the task (distinct from assignee who does the work).
-- Defaults to the task creator; editable afterwards (Jira/Linear convention).

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Backfill: existing tasks report to their creator.
UPDATE public.tasks SET reporter_id = user_id WHERE reporter_id IS NULL;

-- ── create_task: default reporter to the creator when none supplied ──────────
CREATE OR REPLACE FUNCTION public.create_task(p_workstation_id uuid, p_data jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE v_row tasks%rowtype;
BEGIN
  IF NOT has_workspace_permission(p_workstation_id, 'create_task') THEN RAISE EXCEPTION 'permission_denied'; END IF;
  IF nullif(p_data->>'assignee_id','') IS NOT NULL
     AND NOT has_workspace_permission(p_workstation_id, 'assign_task')
  THEN RAISE EXCEPTION 'permission_denied'; END IF;

  INSERT INTO tasks(user_id, workstation_id, task_id, project_short_id, status_id, priority_id, title,
    description, due_date, tag_ids, parent_task_id, est_minutes, gh_branch, assignee_id, reporter_id, created_by, updated_by)
  VALUES (auth.uid(), p_workstation_id, p_data->>'task_id', p_data->>'project_short_id',
    nullif(p_data->>'status_id','')::uuid, nullif(p_data->>'priority_id','')::uuid, p_data->>'title',
    coalesce(p_data->>'description',''), nullif(p_data->>'due_date','')::date,
    (SELECT array_agg(x::uuid) FROM jsonb_array_elements_text(coalesce(p_data->'tag_ids','[]')) x),
    nullif(p_data->>'parent_task_id','')::uuid, coalesce((p_data->>'est_minutes')::int,0),
    nullif(p_data->>'gh_branch',''), nullif(p_data->>'assignee_id','')::uuid,
    coalesce(nullif(p_data->>'reporter_id','')::uuid, auth.uid()), auth.uid(), auth.uid())
  RETURNING * INTO v_row;
  PERFORM log_activity(p_workstation_id, 'task', v_row.id, v_row.title, 'created');
  RETURN row_to_json(v_row)::jsonb;
END;
$function$;

-- ── update_task: allow changing the reporter ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_task(p_task_id text, p_data jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE v_row tasks%rowtype; v_old_status uuid; v_old_assignee uuid; v_id uuid; v_ws uuid;
BEGIN
  SELECT id, status_id, assignee_id, workstation_id INTO v_id, v_old_status, v_old_assignee, v_ws
    FROM tasks WHERE task_id = p_task_id AND deleted_at IS NULL
     AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid())
   LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT has_workspace_permission(v_ws, 'edit_task') THEN RAISE EXCEPTION 'permission_denied'; END IF;
  IF (p_data ? 'assignee_id') AND (nullif(p_data->>'assignee_id','')::uuid IS DISTINCT FROM v_old_assignee)
     AND NOT has_workspace_permission(v_ws, 'assign_task')
  THEN RAISE EXCEPTION 'permission_denied'; END IF;

  UPDATE tasks SET
    status_id = CASE WHEN p_data ? 'status_id' THEN nullif(p_data->>'status_id','')::uuid ELSE status_id END,
    priority_id = nullif(p_data->>'priority_id','')::uuid,
    title = p_data->>'title',
    description = coalesce(p_data->>'description', description),
    due_date = nullif(p_data->>'due_date','')::date,
    tag_ids = (SELECT array_agg(x::uuid) FROM jsonb_array_elements_text(coalesce(p_data->'tag_ids','[]')) x),
    parent_task_id = CASE WHEN p_data ? 'parent_task_id' THEN nullif(p_data->>'parent_task_id','')::uuid ELSE parent_task_id END,
    est_minutes = CASE WHEN p_data ? 'est_minutes' THEN coalesce((p_data->>'est_minutes')::int, est_minutes) ELSE est_minutes END,
    gh_branch = CASE WHEN p_data ? 'gh_branch' THEN nullif(p_data->>'gh_branch','') ELSE gh_branch END,
    assignee_id = CASE WHEN p_data ? 'assignee_id' THEN nullif(p_data->>'assignee_id','')::uuid ELSE assignee_id END,
    reporter_id = CASE WHEN p_data ? 'reporter_id' THEN nullif(p_data->>'reporter_id','')::uuid ELSE reporter_id END,
    updated_at = now(), updated_by = auth.uid()
  WHERE id = v_id
  RETURNING * INTO v_row;

  IF v_old_status IS DISTINCT FROM v_row.status_id THEN
    INSERT INTO public.task_status_logs (task_id, from_status_id, to_status_id, user_id)
    VALUES (v_row.id, v_old_status, v_row.status_id, auth.uid());
  END IF;
  PERFORM log_activity(v_ws, 'task', v_row.id, v_row.title, 'updated');
  RETURN row_to_json(v_row)::jsonb;
END;
$function$;
