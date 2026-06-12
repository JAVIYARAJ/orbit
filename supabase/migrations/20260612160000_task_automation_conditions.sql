-- ════════════════════════════════════════════════════════════════════════════
-- Automation v1.1: per-rule conditions ("only if…").
--
-- Adds an optional filter layer so a rule fires only when the changed task also
-- matches conditions on project / priority / tag / assignment / due date,
-- combined with all (AND) or any (OR). Stored as jsonb:
--   { "match": "all"|"any",
--     "rules": [
--       { "field":"project",  "op":"in",          "values":["ORB","WEB"] },
--       { "field":"priority", "op":"in",          "values":["<pid>"] },
--       { "field":"tag",      "op":"has_any",      "values":["<tid>"] },
--       { "field":"assignee", "op":"is_set"|"is_unset" },
--       { "field":"due",      "op":"overdue"|"none"|"within_days", "value":3 }
--     ] }
-- Empty / absent rules => no filtering (fires for every task).
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE task_automation_rules
  ADD COLUMN IF NOT EXISTS conditions jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ── Evaluate a rule's conditions against a task row ──────────────────────────
CREATE OR REPLACE FUNCTION public.eval_task_automation_conditions(p_conditions jsonb, t public.tasks)
 RETURNS boolean LANGUAGE plpgsql STABLE SET search_path TO 'public'
AS $function$
DECLARE
  v_match text := coalesce(p_conditions->>'match', 'all');
  c       jsonb;
  v_field text;
  v_op    text;
  v_pass  boolean;
  v_any   boolean := false;
  v_all   boolean := true;
  v_count int := 0;
BEGIN
  IF p_conditions IS NULL OR jsonb_typeof(p_conditions->'rules') <> 'array' THEN
    RETURN true;
  END IF;

  FOR c IN SELECT * FROM jsonb_array_elements(p_conditions->'rules') LOOP
    v_count := v_count + 1;
    v_field := c->>'field';
    v_op    := c->>'op';
    v_pass  := false;

    IF v_field = 'project' THEN
      v_pass := t.project_short_id = ANY (ARRAY(SELECT jsonb_array_elements_text(coalesce(c->'values','[]'::jsonb))));
    ELSIF v_field = 'priority' THEN
      v_pass := t.priority_id::text = ANY (ARRAY(SELECT jsonb_array_elements_text(coalesce(c->'values','[]'::jsonb))));
    ELSIF v_field = 'tag' THEN
      v_pass := coalesce(t.tag_ids, '{}') && ARRAY(SELECT jsonb_array_elements_text(coalesce(c->'values','[]'::jsonb))::uuid);
    ELSIF v_field = 'assignee' THEN
      v_pass := CASE WHEN v_op = 'is_unset' THEN t.assignee_id IS NULL ELSE t.assignee_id IS NOT NULL END;
    ELSIF v_field = 'due' THEN
      v_pass := CASE v_op
                  WHEN 'none'        THEN t.due_date IS NULL
                  WHEN 'overdue'     THEN t.due_date IS NOT NULL AND t.due_date < current_date
                  WHEN 'within_days' THEN t.due_date IS NOT NULL AND t.due_date >= current_date
                                          AND t.due_date <= current_date + coalesce((c->>'value')::int, 0)
                  ELSE false
                END;
    ELSE
      v_pass := true;  -- unknown field: don't block
    END IF;

    v_any := v_any OR v_pass;
    v_all := v_all AND v_pass;
  END LOOP;

  IF v_count = 0 THEN RETURN true; END IF;
  RETURN CASE WHEN v_match = 'any' THEN v_any ELSE v_all END;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.eval_task_automation_conditions(jsonb, public.tasks)
  FROM public, authenticated, anon;

-- ── Redefine the dispatcher to honour conditions before acting ───────────────
CREATE OR REPLACE FUNCTION public.dispatch_task_automation()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  r            task_automation_rules%rowtype;
  v_target     uuid;
  v_label      text;
  v_seconds    bigint;
  v_entries    int;
  v_title      text;
  v_preview    text;
  v_message    text;
BEGIN
  SELECT label INTO v_label FROM task_statuses WHERE id = NEW.status_id;

  FOR r IN
    SELECT * FROM task_automation_rules
     WHERE workstation_id = NEW.workstation_id
       AND enabled
       AND deleted_at IS NULL
       AND trigger_event = 'task_status_changed'
       AND trigger_status_id = NEW.status_id
  LOOP
    BEGIN
      -- "only if…" filter: skip rules whose conditions the task doesn't match.
      CONTINUE WHEN NOT eval_task_automation_conditions(r.conditions, NEW);

      v_target := CASE r.action_config->>'target'
                    WHEN 'reporter' THEN NEW.reporter_id
                    ELSE NEW.assignee_id
                  END;
      CONTINUE WHEN v_target IS NULL;

      v_message := nullif(r.action_config->>'message','');

      IF r.action_type = 'notify_time_summary' THEN
        SELECT coalesce(sum(total_seconds), 0), count(*)
          INTO v_seconds, v_entries
          FROM time_entries
         WHERE task_id = NEW.id AND status NOT IN ('running','paused');
        v_title   := 'Task ' || NEW.task_id || ' completed';
        v_preview := coalesce(v_message,
          (v_seconds / 3600)::text || 'h ' || ((v_seconds % 3600) / 60)::text || 'm logged'
          || ' across ' || v_entries::text || ' '
          || CASE WHEN v_entries = 1 THEN 'entry' ELSE 'entries' END);
      ELSE
        v_title   := 'Task ' || NEW.task_id || ' moved to ' || coalesce(v_label, 'a new status');
        v_preview := coalesce(v_message, NEW.title);
      END IF;

      PERFORM notify(v_target, auth.uid(), 'task_automation', NEW.workstation_id,
        'task', NEW.task_id, v_title, v_preview,
        jsonb_build_object('rule_id', r.id, 'status_id', NEW.status_id));
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  RETURN NEW;
END;
$function$;

-- ── CRUD RPCs: read / write the new conditions field ─────────────────────────
CREATE OR REPLACE FUNCTION public.list_task_automation_rules(p_workstation_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_role text; v_result jsonb;
BEGIN
  SELECT role INTO v_role FROM workstation_members
   WHERE workstation_id = p_workstation_id AND user_id = auth.uid();
  IF v_role IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'permission_denied'; END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC), '[]'::jsonb) INTO v_result
  FROM (
    SELECT r.id, r.workstation_id, r.name, r.enabled, r.trigger_event,
           r.trigger_status_id, s.label AS trigger_status_label,
           r.action_type, r.action_config, r.conditions, r.created_at, r.updated_at
      FROM task_automation_rules r
      LEFT JOIN task_statuses s ON s.id = r.trigger_status_id
     WHERE r.workstation_id = p_workstation_id AND r.deleted_at IS NULL
  ) x;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_task_automation_rule(p_workstation_id uuid, p_data jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_role text; v_row task_automation_rules%rowtype;
BEGIN
  SELECT role INTO v_role FROM workstation_members
   WHERE workstation_id = p_workstation_id AND user_id = auth.uid();
  IF v_role IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'permission_denied'; END IF;

  IF coalesce(p_data->>'action_type','') NOT IN ('notify','notify_time_summary')
  THEN RAISE EXCEPTION 'invalid_action_type'; END IF;
  IF coalesce(p_data#>>'{action_config,target}','assignee') NOT IN ('assignee','reporter')
  THEN RAISE EXCEPTION 'invalid_target'; END IF;

  INSERT INTO task_automation_rules(workstation_id, name, enabled, trigger_event,
    trigger_status_id, action_type, action_config, conditions, created_by, updated_by)
  VALUES (p_workstation_id, p_data->>'name', coalesce((p_data->>'enabled')::boolean, true),
    coalesce(nullif(p_data->>'trigger_event',''), 'task_status_changed'),
    (p_data->>'trigger_status_id')::uuid, p_data->>'action_type',
    coalesce(p_data->'action_config', '{}'::jsonb),
    coalesce(p_data->'conditions', '{}'::jsonb), auth.uid(), auth.uid())
  RETURNING * INTO v_row;
  RETURN row_to_json(v_row)::jsonb;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_task_automation_rule(p_id uuid, p_data jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_role text; v_ws uuid; v_row task_automation_rules%rowtype;
BEGIN
  SELECT workstation_id INTO v_ws FROM task_automation_rules WHERE id = p_id AND deleted_at IS NULL;
  IF v_ws IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;

  SELECT role INTO v_role FROM workstation_members
   WHERE workstation_id = v_ws AND user_id = auth.uid();
  IF v_role IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'permission_denied'; END IF;

  IF (p_data ? 'action_type')
     AND (p_data->>'action_type') NOT IN ('notify','notify_time_summary')
  THEN RAISE EXCEPTION 'invalid_action_type'; END IF;
  IF (p_data ? 'action_config')
     AND coalesce(p_data#>>'{action_config,target}','assignee') NOT IN ('assignee','reporter')
  THEN RAISE EXCEPTION 'invalid_target'; END IF;

  UPDATE task_automation_rules SET
    name              = CASE WHEN p_data ? 'name' THEN p_data->>'name' ELSE name END,
    enabled           = CASE WHEN p_data ? 'enabled' THEN (p_data->>'enabled')::boolean ELSE enabled END,
    trigger_status_id = CASE WHEN p_data ? 'trigger_status_id' THEN (p_data->>'trigger_status_id')::uuid ELSE trigger_status_id END,
    action_type       = CASE WHEN p_data ? 'action_type' THEN p_data->>'action_type' ELSE action_type END,
    action_config     = CASE WHEN p_data ? 'action_config' THEN p_data->'action_config' ELSE action_config END,
    conditions        = CASE WHEN p_data ? 'conditions' THEN p_data->'conditions' ELSE conditions END,
    updated_by = auth.uid()
  WHERE id = p_id
  RETURNING * INTO v_row;
  RETURN row_to_json(v_row)::jsonb;
END;
$function$;
