-- Content RPCs: stamp created_by/updated_by/deleted_by and write an activity_log row.
-- Preserves the existing permission guards and membership checks.

-- ── Projects ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_project(p_workstation_id uuid, p_data jsonb)
 RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_row projects%rowtype;
BEGIN
  IF NOT has_workspace_permission(p_workstation_id, 'create_project') THEN RAISE EXCEPTION 'permission_denied'; END IF;
  INSERT INTO projects(user_id, workstation_id, short_id, name, client, description, project_type_id,
    start_date, end_date, status, stack, progress, tasks_count, open_tasks, hours_logged, hours_est, repo, budget,
    created_by, updated_by)
  VALUES (auth.uid(), p_workstation_id, p_data->>'short_id', p_data->>'name', coalesce(p_data->>'client',''),
    coalesce(p_data->>'description',''), nullif(p_data->>'project_type_id','')::uuid, nullif(p_data->>'start_date','')::date,
    nullif(p_data->>'end_date','')::date, p_data->>'status',
    (SELECT array_agg(x) FROM jsonb_array_elements_text(coalesce(p_data->'stack','[]')) x),
    (p_data->>'progress')::int, (p_data->>'tasks_count')::int, (p_data->>'open_tasks')::int,
    (p_data->>'hours_logged')::numeric, (p_data->>'hours_est')::numeric, coalesce(p_data->>'repo',''), coalesce(p_data->>'budget',''),
    auth.uid(), auth.uid())
  RETURNING * INTO v_row;
  PERFORM log_activity(p_workstation_id, 'project', v_row.id, v_row.name, 'created');
  RETURN row_to_json(v_row)::jsonb;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_project(p_short_id text, p_data jsonb)
 RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_row projects%rowtype; v_ws uuid;
BEGIN
  SELECT workstation_id INTO v_ws FROM projects
  WHERE short_id = p_short_id
    AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid());
  IF v_ws IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT has_workspace_permission(v_ws, 'edit_project') THEN RAISE EXCEPTION 'permission_denied'; END IF;
  UPDATE projects SET
    name = p_data->>'name', client = coalesce(p_data->>'client',''),
    description = coalesce(p_data->>'description',''),
    project_type_id = nullif(p_data->>'project_type_id','')::uuid,
    start_date = nullif(p_data->>'start_date','')::date, end_date = nullif(p_data->>'end_date','')::date,
    status = p_data->>'status',
    stack = (SELECT array_agg(x) FROM jsonb_array_elements_text(coalesce(p_data->'stack','[]')) x),
    progress = (p_data->>'progress')::int, tasks_count = (p_data->>'tasks_count')::int,
    open_tasks = (p_data->>'open_tasks')::int, hours_logged = (p_data->>'hours_logged')::numeric,
    hours_est = (p_data->>'hours_est')::numeric, repo = coalesce(p_data->>'repo',''),
    budget = coalesce(p_data->>'budget',''), updated_by = auth.uid()
  WHERE short_id = p_short_id
  RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  PERFORM log_activity(v_ws, 'project', v_row.id, v_row.name, 'updated');
  RETURN row_to_json(v_row)::jsonb;
END;
$function$;

CREATE OR REPLACE FUNCTION public.soft_delete_project(p_short_id text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_ws uuid; v_id uuid; v_name text;
BEGIN
  SELECT workstation_id, id, name INTO v_ws, v_id, v_name FROM public.projects
  WHERE short_id = p_short_id
    AND workstation_id IN (SELECT workstation_id FROM public.workstation_members WHERE user_id = auth.uid())
    AND deleted_at IS NULL;
  IF v_ws IS NULL THEN RAISE EXCEPTION 'Project not found or already deleted'; END IF;
  IF NOT has_workspace_permission(v_ws, 'delete_project') THEN RAISE EXCEPTION 'permission_denied'; END IF;

  UPDATE public.projects SET deleted_at = NOW(), deleted_by = auth.uid() WHERE short_id = p_short_id;
  UPDATE public.tasks SET deleted_at = NOW(), deleted_by = auth.uid()
  WHERE project_short_id = p_short_id AND workstation_id = v_ws AND deleted_at IS NULL;
  PERFORM log_activity(v_ws, 'project', v_id, v_name, 'deleted');
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_project(p_short_id text)
 RETURNS void LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_ws uuid; v_id uuid; v_name text;
BEGIN
  SELECT workstation_id, id, name INTO v_ws, v_id, v_name FROM projects
  WHERE short_id = p_short_id
    AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid());
  IF v_ws IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT has_workspace_permission(v_ws, 'delete_project') THEN RAISE EXCEPTION 'permission_denied'; END IF;
  DELETE FROM projects WHERE short_id = p_short_id;
  PERFORM log_activity(v_ws, 'project', v_id, v_name, 'deleted');
END;
$function$;

-- ── Tasks ────────────────────────────────────────────────────────────────────
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
    description, due_date, tag_ids, parent_task_id, est_minutes, gh_branch, assignee_id, created_by, updated_by)
  VALUES (auth.uid(), p_workstation_id, p_data->>'task_id', p_data->>'project_short_id',
    nullif(p_data->>'status_id','')::uuid, nullif(p_data->>'priority_id','')::uuid, p_data->>'title',
    coalesce(p_data->>'description',''), nullif(p_data->>'due_date','')::date,
    (SELECT array_agg(x::uuid) FROM jsonb_array_elements_text(coalesce(p_data->'tag_ids','[]')) x),
    nullif(p_data->>'parent_task_id','')::uuid, coalesce((p_data->>'est_minutes')::int,0),
    nullif(p_data->>'gh_branch',''), nullif(p_data->>'assignee_id','')::uuid, auth.uid(), auth.uid())
  RETURNING * INTO v_row;
  PERFORM log_activity(p_workstation_id, 'task', v_row.id, v_row.title, 'created');
  RETURN row_to_json(v_row)::jsonb;
END;
$function$;

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

CREATE OR REPLACE FUNCTION public.soft_delete_task(p_task_id text)
 RETURNS void LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_ws uuid; v_id uuid; v_title text;
BEGIN
  SELECT workstation_id, id, title INTO v_ws, v_id, v_title FROM tasks
  WHERE task_id = p_task_id AND deleted_at IS NULL
    AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid());
  IF v_ws IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT has_workspace_permission(v_ws, 'delete_task') THEN RAISE EXCEPTION 'permission_denied'; END IF;
  UPDATE tasks SET deleted_at = now(), deleted_by = auth.uid() WHERE id = v_id;
  PERFORM log_activity(v_ws, 'task', v_id, v_title, 'deleted');
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_task(p_task_id text)
 RETURNS void LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_ws uuid; v_id uuid; v_title text;
BEGIN
  SELECT workstation_id, id, title INTO v_ws, v_id, v_title FROM tasks
  WHERE task_id = p_task_id
    AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid());
  IF v_ws IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT has_workspace_permission(v_ws, 'delete_task') THEN RAISE EXCEPTION 'permission_denied'; END IF;
  DELETE FROM tasks WHERE id = v_id;
  PERFORM log_activity(v_ws, 'task', v_id, v_title, 'deleted');
END;
$function$;

-- ── Notes ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_note(p_workstation_id uuid, p_data jsonb)
 RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_id uuid; v_folder_id uuid;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM workstation_members WHERE workstation_id = p_workstation_id AND user_id = auth.uid())
  THEN RAISE EXCEPTION 'access_denied'; END IF;

  IF p_data->>'folder_id' IS NOT NULL THEN
    v_folder_id := (p_data->>'folder_id')::uuid;
  ELSE
    INSERT INTO note_folders (workstation_id, name) VALUES (p_workstation_id, 'Other')
    ON CONFLICT (workstation_id, name) DO NOTHING;
    SELECT id INTO v_folder_id FROM note_folders WHERE workstation_id = p_workstation_id AND name = 'Other';
  END IF;

  INSERT INTO notes(user_id, workstation_id, title, folder_id, tags, pinned, body, created_by, updated_by)
  VALUES (auth.uid(), p_workstation_id, p_data->>'title', v_folder_id,
    (SELECT array_agg(x) FROM jsonb_array_elements_text(coalesce(p_data->'tags','[]')) x),
    coalesce((p_data->>'pinned')::boolean, false), coalesce(p_data->>'body',''), auth.uid(), auth.uid())
  RETURNING id INTO v_id;
  PERFORM log_activity(p_workstation_id, 'note', v_id, COALESCE(p_data->>'title','Untitled'), 'created');
  RETURN public._note_to_json(v_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_note(p_note_id uuid, p_data jsonb)
 RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_ws uuid; v_title text;
BEGIN
  UPDATE notes SET
    title = p_data->>'title',
    folder_id = CASE WHEN p_data->>'folder_id' IS NOT NULL THEN (p_data->>'folder_id')::uuid ELSE folder_id END,
    tags = (SELECT array_agg(x) FROM jsonb_array_elements_text(coalesce(p_data->'tags','[]')) x),
    pinned = coalesce((p_data->>'pinned')::boolean, pinned),
    body = coalesce(p_data->>'body', body),
    updated_by = auth.uid()
  WHERE id = p_note_id
    AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid())
  RETURNING workstation_id, title INTO v_ws, v_title;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  PERFORM log_activity(v_ws, 'note', p_note_id, v_title, 'updated');
  RETURN public._note_to_json(p_note_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_note(p_note_id uuid)
 RETURNS void LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_ws uuid; v_title text;
BEGIN
  UPDATE notes SET deleted_at = now(), deleted_by = auth.uid()
  WHERE id = p_note_id
    AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid())
    AND deleted_at IS NULL
  RETURNING workstation_id, title INTO v_ws, v_title;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  PERFORM log_activity(v_ws, 'note', p_note_id, v_title, 'deleted');
END;
$function$;

CREATE OR REPLACE FUNCTION public.restore_note(p_note_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_ws uuid; v_title text;
BEGIN
  UPDATE notes SET deleted_at = NULL, deleted_by = NULL, updated_at = now(), updated_by = auth.uid()
  WHERE id = p_note_id
    AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid())
    AND deleted_at IS NOT NULL
  RETURNING workstation_id, title INTO v_ws, v_title;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  PERFORM log_activity(v_ws, 'note', p_note_id, v_title, 'restored');
  RETURN public._note_to_json(p_note_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.purge_note(p_note_id uuid)
 RETURNS void LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_ws uuid; v_title text;
BEGIN
  DELETE FROM notes
  WHERE id = p_note_id
    AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid())
    AND deleted_at IS NOT NULL
  RETURNING workstation_id, title INTO v_ws, v_title;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  PERFORM log_activity(v_ws, 'note', p_note_id, v_title, 'deleted');
END;
$function$;

-- ── Vault ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_vault_item(p_workstation_id uuid, p_data jsonb)
 RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_row vault%rowtype;
BEGIN
  IF NOT has_workspace_permission(p_workstation_id, 'manage_vault') THEN RAISE EXCEPTION 'permission_denied'; END IF;
  INSERT INTO vault(user_id, workstation_id, cat, name, value, is_encrypted, created_by, updated_by)
  VALUES (auth.uid(), p_workstation_id, p_data->>'cat', p_data->>'name', p_data->>'value',
    COALESCE((p_data->>'is_encrypted')::boolean, FALSE), auth.uid(), auth.uid())
  RETURNING * INTO v_row;
  PERFORM log_activity(p_workstation_id, 'vault_item', v_row.id, v_row.name, 'created');
  RETURN row_to_json(v_row)::jsonb;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_vault_item(p_item_id uuid, p_data jsonb)
 RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_row vault%rowtype; v_ws uuid;
BEGIN
  SELECT workstation_id INTO v_ws FROM vault
  WHERE id = p_item_id AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid());
  IF v_ws IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT has_workspace_permission(v_ws, 'manage_vault') THEN RAISE EXCEPTION 'permission_denied'; END IF;
  UPDATE vault SET
    cat = COALESCE(p_data->>'cat', cat), name = p_data->>'name', value = p_data->>'value',
    is_encrypted = COALESCE((p_data->>'is_encrypted')::boolean, is_encrypted),
    updated_at = current_date, updated_by = auth.uid()
  WHERE id = p_item_id
  RETURNING * INTO v_row;
  PERFORM log_activity(v_ws, 'vault_item', v_row.id, v_row.name, 'updated');
  RETURN row_to_json(v_row)::jsonb;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_vault_item(p_item_id uuid)
 RETURNS void LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_ws uuid; v_name text;
BEGIN
  SELECT workstation_id, name INTO v_ws, v_name FROM vault
  WHERE id = p_item_id AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid());
  IF v_ws IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT has_workspace_permission(v_ws, 'manage_vault') THEN RAISE EXCEPTION 'permission_denied'; END IF;
  DELETE FROM vault WHERE id = p_item_id;
  PERFORM log_activity(v_ws, 'vault_item', p_item_id, v_name, 'deleted');
END;
$function$;

CREATE OR REPLACE FUNCTION public.reset_vault(p_workstation_id uuid)
 RETURNS void LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM vault WHERE user_id = auth.uid() AND workstation_id = p_workstation_id;
  DELETE FROM vault_config WHERE user_id = auth.uid() AND workstation_id = p_workstation_id;
  PERFORM log_activity(p_workstation_id, 'vault_item', NULL, 'Vault reset', 'deleted');
END;
$function$;

-- ── Learning ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_learning_item(p_workstation_id uuid, p_data jsonb)
 RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM workstation_members WHERE workstation_id = p_workstation_id AND user_id = auth.uid())
  THEN RAISE EXCEPTION 'Access denied'; END IF;
  INSERT INTO learning (workstation_id, user_id, topic, cat, status, est_hours, actual_hours, link, note,
    needs_review, progress, last_reviewed, difficulty, created_by, updated_by)
  VALUES (p_workstation_id, auth.uid(), p_data->>'topic', COALESCE(p_data->>'cat',''),
    COALESCE(p_data->>'status','to_learn'), NULLIF(p_data->>'est_hours','')::numeric,
    NULLIF(p_data->>'actual_hours','')::numeric, COALESCE(p_data->>'link',''), COALESCE(p_data->>'note',''),
    COALESCE((p_data->>'needs_review')::boolean,false), COALESCE((p_data->>'progress')::integer,0),
    NULLIF(p_data->>'last_reviewed','')::date, NULLIF(p_data->>'difficulty',''), auth.uid(), auth.uid())
  RETURNING id INTO v_id;
  PERFORM log_activity(p_workstation_id, 'learning', v_id, COALESCE(p_data->>'topic','Untitled'), 'created');
  RETURN (SELECT row_to_json(l)::jsonb FROM learning l WHERE l.id = v_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_learning_item(p_item_id uuid, p_data jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE v_ws uuid; v_topic text;
BEGIN
  SELECT workstation_id INTO v_ws FROM learning WHERE id = p_item_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found or access denied'; END IF;
  UPDATE learning SET
    topic = COALESCE(p_data->>'topic', topic), cat = COALESCE(p_data->>'cat', cat),
    status = COALESCE(p_data->>'status', status),
    est_hours = CASE WHEN p_data ? 'est_hours' THEN NULLIF(p_data->>'est_hours','')::numeric ELSE est_hours END,
    actual_hours = CASE WHEN p_data ? 'actual_hours' THEN NULLIF(p_data->>'actual_hours','')::numeric ELSE actual_hours END,
    link = COALESCE(p_data->>'link', link), note = COALESCE(p_data->>'note', note),
    needs_review = CASE WHEN p_data ? 'needs_review' THEN (p_data->>'needs_review')::boolean ELSE needs_review END,
    progress = CASE WHEN p_data ? 'progress' THEN (p_data->>'progress')::integer ELSE progress END,
    last_reviewed = CASE WHEN p_data ? 'last_reviewed' THEN NULLIF(p_data->>'last_reviewed','')::date ELSE last_reviewed END,
    difficulty = CASE WHEN p_data ? 'difficulty' THEN NULLIF(p_data->>'difficulty','') ELSE difficulty END,
    updated_by = auth.uid()
  WHERE id = p_item_id AND user_id = auth.uid()
  RETURNING topic INTO v_topic;
  PERFORM log_activity(v_ws, 'learning', p_item_id, v_topic, 'updated');
  RETURN (SELECT row_to_json(l)::jsonb FROM learning l WHERE l.id = p_item_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_learning_item(p_item_id uuid)
 RETURNS void LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_ws uuid; v_topic text;
BEGIN
  SELECT workstation_id, topic INTO v_ws, v_topic FROM learning WHERE id = p_item_id AND user_id = auth.uid();
  IF v_ws IS NULL THEN RAISE EXCEPTION 'Item not found or access denied'; END IF;
  DELETE FROM learning WHERE id = p_item_id;
  PERFORM log_activity(v_ws, 'learning', p_item_id, v_topic, 'deleted');
END;
$function$;

-- ── Gantt ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_gantt_task(p_workstation_id uuid, p_project_id uuid, p_name text, p_sub text DEFAULT ''::text, p_start_week integer DEFAULT 1, p_end_week integer DEFAULT 2, p_status text DEFAULT 'planning'::text)
 RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_id uuid; v_sort int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM workstation_members WHERE workstation_id = p_workstation_id AND user_id = auth.uid())
  THEN RAISE EXCEPTION 'access_denied'; END IF;
  SELECT COALESCE(MAX(sort_order), 0) + 1 INTO v_sort FROM gantt_tasks
  WHERE workstation_id = p_workstation_id AND project_id = p_project_id;
  INSERT INTO gantt_tasks (workstation_id, project_id, user_id, name, sub, start_week, end_week, status, sort_order, created_by, updated_by)
  VALUES (p_workstation_id, p_project_id, auth.uid(), p_name, p_sub, p_start_week, p_end_week, p_status, v_sort, auth.uid(), auth.uid())
  RETURNING id INTO v_id;
  PERFORM log_activity(p_workstation_id, 'gantt_task', v_id, p_name, 'created');
  RETURN (SELECT row_to_json(r)::jsonb FROM (SELECT * FROM gantt_tasks WHERE id = v_id) r);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_gantt_task(p_id uuid, p_name text, p_sub text, p_start_week integer, p_end_week integer, p_status text)
 RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_ws uuid;
BEGIN
  UPDATE gantt_tasks
  SET name = p_name, sub = p_sub, start_week = p_start_week, end_week = p_end_week, status = p_status, updated_by = auth.uid()
  WHERE id = p_id
    AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid())
  RETURNING workstation_id INTO v_ws;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  PERFORM log_activity(v_ws, 'gantt_task', p_id, p_name, 'updated');
  RETURN (SELECT row_to_json(r)::jsonb FROM (SELECT * FROM gantt_tasks WHERE id = p_id) r);
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_gantt_task(p_id uuid)
 RETURNS void LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_ws uuid; v_name text;
BEGIN
  SELECT workstation_id, name INTO v_ws, v_name FROM gantt_tasks
  WHERE id = p_id AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid());
  IF v_ws IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  DELETE FROM gantt_tasks WHERE id = p_id;
  PERFORM log_activity(v_ws, 'gantt_task', p_id, v_name, 'deleted');
END;
$function$;

-- ── Email templates ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_email_template(p_workstation_id uuid, p_data jsonb)
 RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_row email_templates%rowtype;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM workstation_members WHERE workstation_id = p_workstation_id AND user_id = auth.uid())
  THEN RAISE EXCEPTION 'access_denied'; END IF;
  INSERT INTO email_templates(user_id, workstation_id, template_id, cat, name, body, created_by, updated_by)
  VALUES (auth.uid(), p_workstation_id,
    coalesce(p_data->>'template_id', 'tpl-' || extract(epoch from now())::text),
    p_data->>'cat', p_data->>'name', p_data->>'body', auth.uid(), auth.uid())
  RETURNING * INTO v_row;
  PERFORM log_activity(p_workstation_id, 'email_template', v_row.id, v_row.name, 'created');
  RETURN row_to_json(v_row)::jsonb;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_email_template(p_template_id text, p_data jsonb)
 RETURNS void LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_ws uuid; v_id uuid; v_name text;
BEGIN
  UPDATE email_templates SET
    cat = coalesce(p_data->>'cat', cat), name = p_data->>'name', body = p_data->>'body', updated_by = auth.uid()
  WHERE template_id = p_template_id
    AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid())
  RETURNING workstation_id, id, name INTO v_ws, v_id, v_name;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  PERFORM log_activity(v_ws, 'email_template', v_id, v_name, 'updated');
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_email_template(p_template_id text)
 RETURNS void LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_ws uuid; v_id uuid; v_name text;
BEGIN
  SELECT workstation_id, id, name INTO v_ws, v_id, v_name FROM email_templates
  WHERE template_id = p_template_id
    AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid());
  IF v_ws IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  DELETE FROM email_templates WHERE template_id = p_template_id;
  PERFORM log_activity(v_ws, 'email_template', v_id, v_name, 'deleted');
END;
$function$;
