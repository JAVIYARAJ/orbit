-- ════════════════════════════════════════════════════════════════════════════
-- Automation v1.2: stale-task nudges (a time-based trigger).
--
-- Adds a second trigger type, 'task_stale': a daily pg_cron job scans each
-- workspace for open tasks untouched for N days and pings a recipient (workspace
-- owner / assignee / reporter) via notify(). Reuses the existing conditions
-- filter, and de-dupes so a stale task isn't re-pinged every single day.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Schema: allow the stale trigger type, and make the status optional ───────
ALTER TABLE task_automation_rules DROP CONSTRAINT IF EXISTS task_automation_rules_trigger_event_check;
ALTER TABLE task_automation_rules
  ADD CONSTRAINT task_automation_rules_trigger_event_check
  CHECK (trigger_event IN ('task_status_changed','task_stale'));
ALTER TABLE task_automation_rules ALTER COLUMN trigger_status_id DROP NOT NULL;

-- ── De-dupe ledger: last time a rule nudged a given task ─────────────────────
CREATE TABLE IF NOT EXISTS task_stale_nudges (
  rule_id        uuid NOT NULL REFERENCES task_automation_rules(id) ON DELETE CASCADE,
  task_id        uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  last_nudged_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (rule_id, task_id)
);
-- Internal bookkeeping only — no user ever reads this directly.
ALTER TABLE task_stale_nudges ENABLE ROW LEVEL SECURITY;

-- ── Resolve a rule's recipient for a task (owner / assignee / reporter) ──────
CREATE OR REPLACE FUNCTION public.resolve_automation_target(p_target text, t public.tasks)
 RETURNS uuid LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
  SELECT CASE p_target
           WHEN 'reporter' THEN t.reporter_id
           WHEN 'owner'    THEN (SELECT user_id FROM workstation_members
                                  WHERE workstation_id = t.workstation_id AND role = 'owner' LIMIT 1)
           ELSE t.assignee_id
         END;
$function$;
REVOKE EXECUTE ON FUNCTION public.resolve_automation_target(text, public.tasks) FROM public, authenticated, anon;

-- ── Redefine the status-change dispatcher to support the 'owner' target ──────
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
       AND enabled AND deleted_at IS NULL
       AND trigger_event = 'task_status_changed'
       AND trigger_status_id = NEW.status_id
  LOOP
    BEGIN
      CONTINUE WHEN NOT eval_task_automation_conditions(r.conditions, NEW);

      v_target := resolve_automation_target(r.action_config->>'target', NEW);
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

-- ── The stale-nudge engine. p_workstation_id = NULL → all workspaces (cron);
--    set → just that workspace (manual "run now" from the UI). Returns #nudges. ─
CREATE OR REPLACE FUNCTION public.run_stale_task_nudges(p_workstation_id uuid DEFAULT NULL)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  r         task_automation_rules%rowtype;
  t         tasks%rowtype;
  v_days    int;
  v_target  uuid;
  v_message text;
  v_count   int := 0;
BEGIN
  FOR r IN
    SELECT * FROM task_automation_rules
     WHERE enabled AND deleted_at IS NULL AND trigger_event = 'task_stale'
       AND (p_workstation_id IS NULL OR workstation_id = p_workstation_id)
  LOOP
    v_days    := greatest(coalesce((r.action_config->>'stale_days')::int, 7), 1);
    v_message := nullif(r.action_config->>'message','');

    FOR t IN
      SELECT tk.* FROM tasks tk
      JOIN task_statuses s ON s.id = tk.status_id
     WHERE tk.workstation_id = r.workstation_id
       AND tk.deleted_at IS NULL
       AND coalesce(s.is_done, false) = false
       AND tk.updated_at < now() - make_interval(days => v_days)
    LOOP
      BEGIN
        CONTINUE WHEN NOT eval_task_automation_conditions(r.conditions, t);

        -- de-dupe: don't re-nudge the same task within its staleness window
        IF EXISTS (SELECT 1 FROM task_stale_nudges n
                    WHERE n.rule_id = r.id AND n.task_id = t.id
                      AND n.last_nudged_at > now() - make_interval(days => v_days))
        THEN CONTINUE; END IF;

        v_target := resolve_automation_target(coalesce(r.action_config->>'target','owner'), t);
        CONTINUE WHEN v_target IS NULL;

        PERFORM notify(v_target, NULL, 'task_automation', r.workstation_id,
          'task', t.task_id,
          'Task ' || t.task_id || ' is going stale',
          coalesce(v_message, 'No activity for ' || v_days || ' days — ' || t.title),
          jsonb_build_object('rule_id', r.id, 'kind', 'stale', 'stale_days', v_days));

        INSERT INTO task_stale_nudges(rule_id, task_id, last_nudged_at)
        VALUES (r.id, t.id, now())
        ON CONFLICT (rule_id, task_id) DO UPDATE SET last_nudged_at = now();

        v_count := v_count + 1;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.run_stale_task_nudges(uuid) FROM public, authenticated, anon;

-- Owner-only manual trigger (powers a "Run now" button / verification).
CREATE OR REPLACE FUNCTION public.trigger_stale_nudges(p_workstation_id uuid)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_role text;
BEGIN
  SELECT role INTO v_role FROM workstation_members
   WHERE workstation_id = p_workstation_id AND user_id = auth.uid();
  IF v_role IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'permission_denied'; END IF;
  RETURN run_stale_task_nudges(p_workstation_id);
END;
$function$;
GRANT EXECUTE ON FUNCTION public.trigger_stale_nudges(uuid) TO authenticated;

-- ── CRUD RPCs: validate the new trigger type + 'owner' target ────────────────
CREATE OR REPLACE FUNCTION public.create_task_automation_rule(p_workstation_id uuid, p_data jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_role text; v_row task_automation_rules%rowtype; v_event text;
BEGIN
  SELECT role INTO v_role FROM workstation_members
   WHERE workstation_id = p_workstation_id AND user_id = auth.uid();
  IF v_role IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'permission_denied'; END IF;

  v_event := coalesce(nullif(p_data->>'trigger_event',''), 'task_status_changed');
  IF v_event NOT IN ('task_status_changed','task_stale') THEN RAISE EXCEPTION 'invalid_trigger_event'; END IF;
  IF coalesce(p_data->>'action_type','') NOT IN ('notify','notify_time_summary')
  THEN RAISE EXCEPTION 'invalid_action_type'; END IF;
  IF coalesce(p_data#>>'{action_config,target}','assignee') NOT IN ('assignee','reporter','owner')
  THEN RAISE EXCEPTION 'invalid_target'; END IF;
  IF v_event = 'task_status_changed' AND nullif(p_data->>'trigger_status_id','') IS NULL
  THEN RAISE EXCEPTION 'trigger_status_required'; END IF;

  INSERT INTO task_automation_rules(workstation_id, name, enabled, trigger_event,
    trigger_status_id, action_type, action_config, conditions, created_by, updated_by)
  VALUES (p_workstation_id, p_data->>'name', coalesce((p_data->>'enabled')::boolean, true),
    v_event, nullif(p_data->>'trigger_status_id','')::uuid, p_data->>'action_type',
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

  IF (p_data ? 'trigger_event')
     AND (p_data->>'trigger_event') NOT IN ('task_status_changed','task_stale')
  THEN RAISE EXCEPTION 'invalid_trigger_event'; END IF;
  IF (p_data ? 'action_type')
     AND (p_data->>'action_type') NOT IN ('notify','notify_time_summary')
  THEN RAISE EXCEPTION 'invalid_action_type'; END IF;
  IF (p_data ? 'action_config')
     AND coalesce(p_data#>>'{action_config,target}','assignee') NOT IN ('assignee','reporter','owner')
  THEN RAISE EXCEPTION 'invalid_target'; END IF;

  UPDATE task_automation_rules SET
    name              = CASE WHEN p_data ? 'name' THEN p_data->>'name' ELSE name END,
    enabled           = CASE WHEN p_data ? 'enabled' THEN (p_data->>'enabled')::boolean ELSE enabled END,
    trigger_event     = CASE WHEN p_data ? 'trigger_event' THEN p_data->>'trigger_event' ELSE trigger_event END,
    trigger_status_id = CASE WHEN p_data ? 'trigger_status_id' THEN nullif(p_data->>'trigger_status_id','')::uuid ELSE trigger_status_id END,
    action_type       = CASE WHEN p_data ? 'action_type' THEN p_data->>'action_type' ELSE action_type END,
    action_config     = CASE WHEN p_data ? 'action_config' THEN p_data->'action_config' ELSE action_config END,
    conditions        = CASE WHEN p_data ? 'conditions' THEN p_data->'conditions' ELSE conditions END,
    updated_by = auth.uid()
  WHERE id = p_id
  RETURNING * INTO v_row;
  RETURN row_to_json(v_row)::jsonb;
END;
$function$;

-- ── Schedule the daily scan (09:00 UTC). Reschedule cleanly on re-run. ───────
DO $cron$
BEGIN
  PERFORM cron.unschedule('stale-task-nudges');
EXCEPTION WHEN OTHERS THEN NULL;
END
$cron$;
SELECT cron.schedule('stale-task-nudges', '0 9 * * *', $$ SELECT public.run_stale_task_nudges(); $$);
