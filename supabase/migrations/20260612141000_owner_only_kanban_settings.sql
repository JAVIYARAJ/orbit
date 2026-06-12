-- Lock workspace Kanban configuration (statuses, project types, priorities) and
-- destructive tag operations (rename/recolor/delete) to the workspace OWNER only.
-- Previously these allowed owner+admin (statuses/types/priorities) or any member
-- (tag edits), letting invited users change workspace-wide settings.
--
-- create_tag is intentionally left at membership level: it is also used inline
-- while tagging a task, a normal member workflow. Only tag *management*
-- (update/delete) — reachable only from the owner-gated settings tab — is locked.

-- ── Task statuses (Kanban columns) ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_task_status(p_workstation_id uuid, p_data jsonb)
 RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_row task_statuses%rowtype; v_max integer; v_done boolean;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM workstation_members
    WHERE workstation_id = p_workstation_id AND user_id = auth.uid() AND role = 'owner')
  THEN RAISE EXCEPTION 'access_denied'; END IF;
  v_done := COALESCE((p_data->>'is_done')::boolean, false);
  SELECT COALESCE(MAX(sort_order) + 1, 0) INTO v_max FROM task_statuses WHERE workstation_id = p_workstation_id;
  IF v_done THEN UPDATE task_statuses SET is_done = false WHERE workstation_id = p_workstation_id; END IF;
  INSERT INTO task_statuses (workstation_id, key, label, color, sort_order, is_done)
  VALUES (p_workstation_id, p_data->>'key', p_data->>'label', COALESCE(p_data->>'color','#888888'),
    COALESCE((p_data->>'sort_order')::int, v_max), v_done)
  RETURNING * INTO v_row;
  PERFORM log_activity(p_workstation_id, 'task_status', v_row.id, v_row.label, 'created');
  RETURN row_to_json(v_row)::jsonb;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_task_status(p_status_id uuid, p_data jsonb)
 RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_row task_statuses%rowtype; v_ws_id uuid; v_done boolean;
BEGIN
  SELECT workstation_id INTO v_ws_id FROM task_statuses WHERE id = p_status_id;
  IF NOT EXISTS(SELECT 1 FROM workstation_members
    WHERE workstation_id = v_ws_id AND user_id = auth.uid() AND role = 'owner')
  THEN RAISE EXCEPTION 'access_denied'; END IF;
  v_done := (p_data->>'is_done')::boolean;
  IF v_done IS NOT NULL AND v_done = true THEN
    UPDATE task_statuses SET is_done = false WHERE workstation_id = v_ws_id;
  END IF;
  UPDATE task_statuses SET
    label = COALESCE(p_data->>'label', label), color = COALESCE(p_data->>'color', color),
    is_done = COALESCE(v_done, is_done)
  WHERE id = p_status_id
  RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  PERFORM log_activity(v_ws_id, 'task_status', v_row.id, v_row.label, 'updated');
  RETURN row_to_json(v_row)::jsonb;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_task_status(p_status_id uuid)
 RETURNS void LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_ws uuid; v_label text;
BEGIN
  SELECT workstation_id, label INTO v_ws, v_label FROM task_statuses
  WHERE id = p_status_id
    AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid() AND role = 'owner');
  IF v_ws IS NULL THEN RETURN; END IF;
  DELETE FROM task_statuses WHERE id = p_status_id;
  PERFORM log_activity(v_ws, 'task_status', p_status_id, v_label, 'deleted');
END;
$function$;

-- ── Project types ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_project_type(p_workstation_id uuid, p_data jsonb)
 RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_row project_types%rowtype;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM workstation_members
    WHERE workstation_id = p_workstation_id AND user_id = auth.uid() AND role = 'owner')
  THEN RAISE EXCEPTION 'access_denied'; END IF;
  INSERT INTO project_types(workstation_id, label, sort_order)
  VALUES (p_workstation_id, p_data->>'label', coalesce((p_data->>'sort_order')::int, 0))
  RETURNING * INTO v_row;
  PERFORM log_activity(p_workstation_id, 'project_type', v_row.id, v_row.label, 'created');
  RETURN row_to_json(v_row)::jsonb;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_project_type(p_type_id uuid, p_data jsonb)
 RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_row project_types%rowtype;
BEGIN
  UPDATE project_types SET
    label = coalesce(p_data->>'label', label),
    sort_order = coalesce((p_data->>'sort_order')::int, sort_order)
  WHERE id = p_type_id
    AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid() AND role = 'owner')
  RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  PERFORM log_activity(v_row.workstation_id, 'project_type', v_row.id, v_row.label, 'updated');
  RETURN row_to_json(v_row)::jsonb;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_project_type(p_type_id uuid)
 RETURNS void LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_ws uuid; v_label text;
BEGIN
  SELECT workstation_id, label INTO v_ws, v_label FROM project_types
  WHERE id = p_type_id
    AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid() AND role = 'owner');
  IF v_ws IS NULL THEN RETURN; END IF;
  DELETE FROM project_types WHERE id = p_type_id;
  PERFORM log_activity(v_ws, 'project_type', p_type_id, v_label, 'deleted');
END;
$function$;

-- ── Tags: lock management (rename/recolor/delete) to owner; create stays open ─
CREATE OR REPLACE FUNCTION public.update_tag(p_tag_id uuid, p_data jsonb)
 RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_row tags%rowtype;
BEGIN
  UPDATE tags SET
    name = coalesce(nullif(p_data->>'name',''), name),
    color = coalesce(nullif(p_data->>'color',''), color)
  WHERE id = p_tag_id
    AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid() AND role = 'owner')
  RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  PERFORM log_activity(v_row.workstation_id, 'tag', v_row.id, v_row.name, 'updated');
  RETURN row_to_json(v_row)::jsonb;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_tag(p_tag_id uuid)
 RETURNS void LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_ws uuid; v_name text;
BEGIN
  SELECT workstation_id, name INTO v_ws, v_name FROM tags WHERE id = p_tag_id;
  IF NOT EXISTS(SELECT 1 FROM workstation_members WHERE workstation_id = v_ws AND user_id = auth.uid() AND role = 'owner')
  THEN RAISE EXCEPTION 'access_denied'; END IF;
  UPDATE tasks SET tag_ids = array_remove(tag_ids, p_tag_id)
  WHERE workstation_id = v_ws AND tag_ids @> ARRAY[p_tag_id];
  DELETE FROM tags WHERE id = p_tag_id;
  PERFORM log_activity(v_ws, 'tag', p_tag_id, v_name, 'deleted');
END;
$function$;

-- ── Task priorities ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_task_priority(p_workstation_id uuid, p_data jsonb)
 RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_row task_priorities%rowtype;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM workstation_members
    WHERE workstation_id = p_workstation_id AND user_id = auth.uid() AND role = 'owner')
  THEN RAISE EXCEPTION 'access_denied'; END IF;
  INSERT INTO task_priorities(workstation_id, label, color, sort_order)
  VALUES (p_workstation_id, p_data->>'label', coalesce(p_data->>'color','#888888'), coalesce((p_data->>'sort_order')::int, 999))
  RETURNING * INTO v_row;
  PERFORM log_activity(p_workstation_id, 'task_priority', v_row.id, v_row.label, 'created');
  RETURN row_to_json(v_row)::jsonb;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_task_priority(p_priority_id uuid, p_data jsonb)
 RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_row task_priorities%rowtype;
BEGIN
  UPDATE task_priorities SET
    label = coalesce(p_data->>'label', label), color = coalesce(p_data->>'color', color),
    sort_order = coalesce((p_data->>'sort_order')::int, sort_order)
  WHERE id = p_priority_id
    AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid() AND role = 'owner')
  RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  PERFORM log_activity(v_row.workstation_id, 'task_priority', v_row.id, v_row.label, 'updated');
  RETURN row_to_json(v_row)::jsonb;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_task_priority(p_priority_id uuid)
 RETURNS void LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_ws uuid; v_label text;
BEGIN
  SELECT workstation_id, label INTO v_ws, v_label FROM task_priorities
  WHERE id = p_priority_id
    AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid() AND role = 'owner');
  IF v_ws IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  DELETE FROM task_priorities WHERE id = p_priority_id;
  PERFORM log_activity(v_ws, 'task_priority', p_priority_id, v_label, 'deleted');
END;
$function$;
