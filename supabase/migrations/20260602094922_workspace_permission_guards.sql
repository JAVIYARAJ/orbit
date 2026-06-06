-- Server-side enforcement of workspace role permissions.
CREATE OR REPLACE FUNCTION public.has_workspace_permission(p_workstation_id uuid, p_action text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role     text;
  v_override boolean;
  v_default  boolean;
BEGIN
  SELECT role INTO v_role
  FROM workstation_members
  WHERE workstation_id = p_workstation_id AND user_id = auth.uid();

  IF v_role IS NULL THEN RETURN false; END IF;
  IF v_role = 'owner' THEN RETURN true;  END IF;

  SELECT allowed INTO v_override
  FROM workspace_role_permissions
  WHERE workstation_id = p_workstation_id
    AND role = v_role
    AND permission_key = p_action;
  IF FOUND THEN RETURN v_override; END IF;

  v_default := CASE
    WHEN v_role = 'admin' THEN CASE p_action
      WHEN 'create_project' THEN true
      WHEN 'edit_project'   THEN true
      WHEN 'delete_project' THEN false
      WHEN 'create_task'    THEN true
      WHEN 'edit_task'      THEN true
      WHEN 'delete_task'    THEN true
      WHEN 'assign_task'    THEN true
      WHEN 'manage_vault'   THEN false
      WHEN 'view_vault'     THEN false
      WHEN 'invite_member'  THEN true
      WHEN 'remove_member'  THEN true
      WHEN 'change_role'    THEN false
      ELSE false
    END
    WHEN v_role = 'member' THEN CASE p_action
      WHEN 'create_task' THEN true
      WHEN 'edit_task'   THEN true
      WHEN 'assign_task' THEN true
      ELSE false
    END
    ELSE false
  END;

  RETURN coalesce(v_default, false);
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_project(p_workstation_id uuid, p_data jsonb)
 RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_row projects%rowtype;
BEGIN
  IF NOT has_workspace_permission(p_workstation_id, 'create_project')
  THEN RAISE EXCEPTION 'permission_denied'; END IF;

  INSERT INTO projects(user_id, workstation_id, short_id, name, client, description, project_type_id,
    start_date, end_date, status, stack, progress, tasks_count, open_tasks,
    hours_logged, hours_est, repo, budget)
  VALUES (
    auth.uid(), p_workstation_id,
    p_data->>'short_id', p_data->>'name',
    coalesce(p_data->>'client',''),
    coalesce(p_data->>'description',''),
    nullif(p_data->>'project_type_id','')::uuid,
    nullif(p_data->>'start_date','')::date,
    nullif(p_data->>'end_date','')::date,
    p_data->>'status',
    (SELECT array_agg(x) FROM jsonb_array_elements_text(coalesce(p_data->'stack','[]')) x),
    (p_data->>'progress')::int,
    (p_data->>'tasks_count')::int,
    (p_data->>'open_tasks')::int,
    (p_data->>'hours_logged')::numeric,
    (p_data->>'hours_est')::numeric,
    coalesce(p_data->>'repo',''),
    coalesce(p_data->>'budget','')
  ) RETURNING * INTO v_row;
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
    name = p_data->>'name',
    client = coalesce(p_data->>'client',''),
    description = coalesce(p_data->>'description',''),
    project_type_id = nullif(p_data->>'project_type_id','')::uuid,
    start_date = nullif(p_data->>'start_date','')::date,
    end_date = nullif(p_data->>'end_date','')::date,
    status = p_data->>'status',
    stack = (SELECT array_agg(x) FROM jsonb_array_elements_text(coalesce(p_data->'stack','[]')) x),
    progress = (p_data->>'progress')::int,
    tasks_count = (p_data->>'tasks_count')::int,
    open_tasks = (p_data->>'open_tasks')::int,
    hours_logged = (p_data->>'hours_logged')::numeric,
    hours_est = (p_data->>'hours_est')::numeric,
    repo = coalesce(p_data->>'repo',''),
    budget = coalesce(p_data->>'budget','')
  WHERE short_id = p_short_id
  RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  RETURN row_to_json(v_row)::jsonb;
END;
$function$;

CREATE OR REPLACE FUNCTION public.soft_delete_project(p_short_id text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_workstation_id UUID;
BEGIN
  SELECT workstation_id INTO v_workstation_id FROM public.projects
  WHERE short_id = p_short_id
    AND workstation_id IN (SELECT workstation_id FROM public.workstation_members WHERE user_id = auth.uid())
    AND deleted_at IS NULL;
  IF v_workstation_id IS NULL THEN RAISE EXCEPTION 'Project not found or already deleted'; END IF;
  IF NOT has_workspace_permission(v_workstation_id, 'delete_project') THEN RAISE EXCEPTION 'permission_denied'; END IF;

  UPDATE public.projects SET deleted_at = NOW() WHERE short_id = p_short_id;
  UPDATE public.tasks SET deleted_at = NOW()
  WHERE project_short_id = p_short_id AND workstation_id = v_workstation_id AND deleted_at IS NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_project(p_short_id text)
 RETURNS void LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_ws uuid;
BEGIN
  SELECT workstation_id INTO v_ws FROM projects
  WHERE short_id = p_short_id
    AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid());
  IF v_ws IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT has_workspace_permission(v_ws, 'delete_project') THEN RAISE EXCEPTION 'permission_denied'; END IF;
  DELETE FROM projects WHERE short_id = p_short_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_task(p_workstation_id uuid, p_data jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE v_row tasks%rowtype;
BEGIN
  IF NOT has_workspace_permission(p_workstation_id, 'create_task') THEN RAISE EXCEPTION 'permission_denied'; END IF;
  IF nullif(p_data->>'assignee_id','') IS NOT NULL
     AND NOT has_workspace_permission(p_workstation_id, 'assign_task')
  THEN RAISE EXCEPTION 'permission_denied'; END IF;

  INSERT INTO tasks(
    user_id, workstation_id, task_id, project_short_id, status_id,
    priority_id, title, description, due_date, tag_ids, parent_task_id,
    est_minutes, gh_branch, assignee_id
  ) VALUES (
    auth.uid(), p_workstation_id,
    p_data->>'task_id',
    p_data->>'project_short_id',
    nullif(p_data->>'status_id', '')::uuid,
    nullif(p_data->>'priority_id', '')::uuid,
    p_data->>'title',
    coalesce(p_data->>'description', ''),
    nullif(p_data->>'due_date', '')::date,
    (SELECT array_agg(x::uuid) FROM jsonb_array_elements_text(coalesce(p_data->'tag_ids', '[]')) x),
    nullif(p_data->>'parent_task_id', '')::uuid,
    coalesce((p_data->>'est_minutes')::int, 0),
    nullif(p_data->>'gh_branch', ''),
    nullif(p_data->>'assignee_id', '')::uuid
  ) RETURNING * INTO v_row;
  RETURN row_to_json(v_row)::jsonb;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_task(p_task_id text, p_data jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE
  v_row tasks%rowtype; v_old_status uuid; v_old_assignee uuid; v_id uuid; v_ws uuid;
BEGIN
  SELECT id, status_id, assignee_id, workstation_id
    INTO v_id, v_old_status, v_old_assignee, v_ws
    FROM tasks
   WHERE task_id = p_task_id AND deleted_at IS NULL
     AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid())
   LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;

  IF NOT has_workspace_permission(v_ws, 'edit_task') THEN RAISE EXCEPTION 'permission_denied'; END IF;
  IF (p_data ? 'assignee_id')
     AND (nullif(p_data->>'assignee_id','')::uuid IS DISTINCT FROM v_old_assignee)
     AND NOT has_workspace_permission(v_ws, 'assign_task')
  THEN RAISE EXCEPTION 'permission_denied'; END IF;

  UPDATE tasks SET
    status_id = CASE WHEN p_data ? 'status_id' THEN nullif(p_data->>'status_id', '')::uuid ELSE status_id END,
    priority_id = nullif(p_data->>'priority_id', '')::uuid,
    title = p_data->>'title',
    description = coalesce(p_data->>'description', description),
    due_date = nullif(p_data->>'due_date', '')::date,
    tag_ids = (SELECT array_agg(x::uuid) FROM jsonb_array_elements_text(coalesce(p_data->'tag_ids', '[]')) x),
    parent_task_id = CASE WHEN p_data ? 'parent_task_id' THEN nullif(p_data->>'parent_task_id', '')::uuid ELSE parent_task_id END,
    est_minutes = CASE WHEN p_data ? 'est_minutes' THEN coalesce((p_data->>'est_minutes')::int, est_minutes) ELSE est_minutes END,
    gh_branch = CASE WHEN p_data ? 'gh_branch' THEN nullif(p_data->>'gh_branch', '') ELSE gh_branch END,
    assignee_id = CASE WHEN p_data ? 'assignee_id' THEN nullif(p_data->>'assignee_id', '')::uuid ELSE assignee_id END,
    updated_at = now()
  WHERE id = v_id
  RETURNING * INTO v_row;

  IF v_old_status IS DISTINCT FROM v_row.status_id THEN
    INSERT INTO public.task_status_logs (task_id, from_status_id, to_status_id, user_id)
    VALUES (v_row.id, v_old_status, v_row.status_id, auth.uid());
  END IF;
  RETURN row_to_json(v_row)::jsonb;
END;
$function$;

CREATE OR REPLACE FUNCTION public.soft_delete_task(p_task_id text)
 RETURNS void LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_ws uuid;
BEGIN
  SELECT workstation_id INTO v_ws FROM tasks
  WHERE task_id = p_task_id AND deleted_at IS NULL
    AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid());
  IF v_ws IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT has_workspace_permission(v_ws, 'delete_task') THEN RAISE EXCEPTION 'permission_denied'; END IF;
  UPDATE tasks SET deleted_at = now() WHERE task_id = p_task_id AND workstation_id = v_ws;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_task(p_task_id text)
 RETURNS void LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_ws uuid;
BEGIN
  SELECT workstation_id INTO v_ws FROM tasks
  WHERE task_id = p_task_id
    AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid());
  IF v_ws IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT has_workspace_permission(v_ws, 'delete_task') THEN RAISE EXCEPTION 'permission_denied'; END IF;
  DELETE FROM tasks WHERE task_id = p_task_id AND workstation_id = v_ws;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_vault_item(p_workstation_id uuid, p_data jsonb)
 RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_row vault%rowtype;
BEGIN
  IF NOT has_workspace_permission(p_workstation_id, 'manage_vault') THEN RAISE EXCEPTION 'permission_denied'; END IF;
  INSERT INTO vault(user_id, workstation_id, cat, name, value, is_encrypted)
  VALUES (auth.uid(), p_workstation_id, p_data->>'cat', p_data->>'name', p_data->>'value',
    COALESCE((p_data->>'is_encrypted')::boolean, FALSE))
  RETURNING * INTO v_row;
  RETURN row_to_json(v_row)::jsonb;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_vault_item(p_item_id uuid, p_data jsonb)
 RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_row vault%rowtype; v_ws uuid;
BEGIN
  SELECT workstation_id INTO v_ws FROM vault
  WHERE id = p_item_id
    AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid());
  IF v_ws IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT has_workspace_permission(v_ws, 'manage_vault') THEN RAISE EXCEPTION 'permission_denied'; END IF;

  UPDATE vault SET
    cat = COALESCE(p_data->>'cat', cat),
    name = p_data->>'name',
    value = p_data->>'value',
    is_encrypted = COALESCE((p_data->>'is_encrypted')::boolean, is_encrypted),
    updated_at = current_date
  WHERE id = p_item_id
  RETURNING * INTO v_row;
  RETURN row_to_json(v_row)::jsonb;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_vault_item(p_item_id uuid)
 RETURNS void LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_ws uuid;
BEGIN
  SELECT workstation_id INTO v_ws FROM vault
  WHERE id = p_item_id
    AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid());
  IF v_ws IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT has_workspace_permission(v_ws, 'manage_vault') THEN RAISE EXCEPTION 'permission_denied'; END IF;
  DELETE FROM vault WHERE id = p_item_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.invite_member(p_workstation_id uuid, p_email text, p_role text, p_workspace_name text, p_inviter_name text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_result JSONB; v_is_owner BOOLEAN;
BEGIN
  IF p_role NOT IN ('admin','member','viewer') THEN RAISE EXCEPTION 'invalid_role'; END IF;
  IF NOT has_workspace_permission(p_workstation_id, 'invite_member') THEN RAISE EXCEPTION 'permission_denied'; END IF;

  SELECT EXISTS(SELECT 1 FROM workstation_members
    WHERE workstation_id = p_workstation_id AND user_id = auth.uid() AND role = 'owner') INTO v_is_owner;
  IF p_role = 'admin' AND NOT v_is_owner
     AND NOT has_workspace_permission(p_workstation_id, 'change_role') THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  INSERT INTO workspace_invites (workstation_id, invited_by, email, role, workspace_name, inviter_name)
  VALUES (p_workstation_id, auth.uid(), p_email, p_role, p_workspace_name, p_inviter_name)
  ON CONFLICT (token) DO NOTHING
  RETURNING jsonb_build_object('id', id, 'token', token, 'email', email, 'role', role,
    'status', status, 'created_at', created_at, 'expires_at', expires_at) INTO v_result;

  IF v_result IS NULL THEN
    UPDATE workspace_invites
    SET expires_at = NOW() + INTERVAL '7 days', role = p_role,
        workspace_name = p_workspace_name, inviter_name = p_inviter_name
    WHERE workstation_id = p_workstation_id AND email = p_email AND status = 'pending'
    RETURNING jsonb_build_object('id', id, 'token', token, 'email', email, 'role', role,
      'status', status, 'created_at', created_at, 'expires_at', expires_at) INTO v_result;
  END IF;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_member_role(p_workstation_id uuid, p_user_id uuid, p_role text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_target_role text;
BEGIN
  IF p_role NOT IN ('admin','member','viewer') THEN RAISE EXCEPTION 'invalid_role'; END IF;
  IF NOT has_workspace_permission(p_workstation_id, 'change_role') THEN RAISE EXCEPTION 'permission_denied'; END IF;

  SELECT role INTO v_target_role FROM workstation_members
  WHERE workstation_id = p_workstation_id AND user_id = p_user_id;
  IF v_target_role IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_target_role = 'owner' THEN RAISE EXCEPTION 'permission_denied'; END IF;

  UPDATE workstation_members SET role = p_role
  WHERE workstation_id = p_workstation_id AND user_id = p_user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.remove_member(p_workstation_id uuid, p_user_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_caller_role text; v_target_role text;
BEGIN
  IF p_user_id = auth.uid() THEN RAISE EXCEPTION 'permission_denied'; END IF;
  SELECT role INTO v_caller_role FROM workstation_members
  WHERE workstation_id = p_workstation_id AND user_id = auth.uid();
  SELECT role INTO v_target_role FROM workstation_members
  WHERE workstation_id = p_workstation_id AND user_id = p_user_id;
  IF v_target_role IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT has_workspace_permission(p_workstation_id, 'remove_member') THEN RAISE EXCEPTION 'permission_denied'; END IF;
  IF v_target_role = 'owner' THEN RAISE EXCEPTION 'permission_denied'; END IF;
  IF v_target_role = 'admin' AND v_caller_role <> 'owner' THEN RAISE EXCEPTION 'permission_denied'; END IF;

  UPDATE tasks SET assignee_id = NULL WHERE workstation_id = p_workstation_id AND assignee_id = p_user_id;
  DELETE FROM workstation_members WHERE workstation_id = p_workstation_id AND user_id = p_user_id;
END;
$function$;
