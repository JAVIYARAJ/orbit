-- ════════════════════════════════════════════════════════════════════════════
-- Automation module (v1): rule-based task-status triggers ("when X then Y").
--
-- An owner configures per-workspace rules that fire when a task enters a chosen
-- status. v1 actions both send an in-app notification (reusing notify()):
--   • notify              → ping the task's assignee/reporter that it reached a status
--   • notify_time_summary → ping them with the task's total logged time (for "Done")
--
-- Execution is a single AFTER UPDATE trigger on tasks, so it fires regardless of
-- which UI path changed the status. Mirrors existing conventions (SECURITY
-- DEFINER, search_path=public, workstation_members guard, soft-delete + audit).
-- ════════════════════════════════════════════════════════════════════════════

-- ── Rule storage ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_automation_rules (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workstation_id    uuid NOT NULL REFERENCES workstations(id) ON DELETE CASCADE,
  name              text NOT NULL,
  enabled           boolean NOT NULL DEFAULT true,
  trigger_event     text NOT NULL DEFAULT 'task_status_changed'
                    CHECK (trigger_event IN ('task_status_changed')),
  trigger_status_id uuid NOT NULL REFERENCES task_statuses(id) ON DELETE CASCADE,
  action_type       text NOT NULL CHECK (action_type IN ('notify','notify_time_summary')),
  action_config     jsonb NOT NULL DEFAULT '{}'::jsonb,   -- { "target": "assignee"|"reporter", "message": "<optional>" }
  created_by        uuid REFERENCES auth.users(id),
  updated_by        uuid REFERENCES auth.users(id),
  deleted_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS task_automation_rules_ws_idx
  ON task_automation_rules (workstation_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS task_automation_rules_status_idx
  ON task_automation_rules (trigger_status_id) WHERE enabled AND deleted_at IS NULL;

-- Keep updated_at fresh (reuses the shared trigger function from initial schema).
DROP TRIGGER IF EXISTS trg_task_automation_rules_upd ON task_automation_rules;
CREATE TRIGGER trg_task_automation_rules_upd
  BEFORE UPDATE ON task_automation_rules
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── RLS: owner-only, defense-in-depth (CRUD also goes through definer RPCs) ───
ALTER TABLE task_automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY tar_owner ON task_automation_rules FOR ALL
  USING      (EXISTS (SELECT 1 FROM workstation_members wm
                       WHERE wm.workstation_id = task_automation_rules.workstation_id
                         AND wm.user_id = auth.uid() AND wm.role = 'owner'))
  WITH CHECK (EXISTS (SELECT 1 FROM workstation_members wm
                       WHERE wm.workstation_id = task_automation_rules.workstation_id
                         AND wm.user_id = auth.uid() AND wm.role = 'owner'));

-- ════════════════════════════════════════════════════════════════════════════
-- EXECUTION ENGINE — fire matching rules on every task status change
-- ════════════════════════════════════════════════════════════════════════════
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
    -- Isolate each rule: a misconfigured rule must never block the task update.
    BEGIN
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
      NULL;  -- swallow: automation failures never break the originating task update
    END;
  END LOOP;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_task_automation ON tasks;
CREATE TRIGGER trg_task_automation
  AFTER UPDATE ON tasks
  FOR EACH ROW
  WHEN (OLD.status_id IS DISTINCT FROM NEW.status_id)
  EXECUTE FUNCTION public.dispatch_task_automation();

-- ════════════════════════════════════════════════════════════════════════════
-- OWNER-ONLY CRUD RPCs (called from the browser; guard on owner role)
-- ════════════════════════════════════════════════════════════════════════════

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
           r.action_type, r.action_config, r.created_at, r.updated_at
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
    trigger_status_id, action_type, action_config, created_by, updated_by)
  VALUES (p_workstation_id, p_data->>'name', coalesce((p_data->>'enabled')::boolean, true),
    coalesce(nullif(p_data->>'trigger_event',''), 'task_status_changed'),
    (p_data->>'trigger_status_id')::uuid, p_data->>'action_type',
    coalesce(p_data->'action_config', '{}'::jsonb), auth.uid(), auth.uid())
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
    updated_by = auth.uid()
  WHERE id = p_id
  RETURNING * INTO v_row;
  RETURN row_to_json(v_row)::jsonb;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_task_automation_rule(p_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_role text; v_ws uuid;
BEGIN
  SELECT workstation_id INTO v_ws FROM task_automation_rules WHERE id = p_id AND deleted_at IS NULL;
  IF v_ws IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;

  SELECT role INTO v_role FROM workstation_members
   WHERE workstation_id = v_ws AND user_id = auth.uid();
  IF v_role IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'permission_denied'; END IF;

  UPDATE task_automation_rules SET deleted_at = now(), updated_by = auth.uid() WHERE id = p_id;
END;
$function$;

-- The dispatcher calls notify() (REVOKEd from authenticated); it runs as a
-- SECURITY DEFINER trigger owned by the migration role, so it retains access.
REVOKE EXECUTE ON FUNCTION public.dispatch_task_automation() FROM public, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.list_task_automation_rules(uuid)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_task_automation_rule(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_task_automation_rule(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_task_automation_rule(uuid)        TO authenticated;
