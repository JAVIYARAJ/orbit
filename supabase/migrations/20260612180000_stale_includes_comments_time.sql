-- ════════════════════════════════════════════════════════════════════════════
-- Automation v1.3: widen "untouched" for stale nudges.
--
-- Previously a task counted as touched only when its own row changed
-- (tasks.updated_at). Comments and time entries live in separate tables and so
-- didn't reset the staleness clock. This adds a helper that takes the greatest
-- of the task's updated_at, its latest comment, and its latest time entry, and
-- routes the stale scan through it. Now real activity — discussion or logged
-- time — keeps a task "fresh".
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.task_last_activity_at(p_task_id uuid, p_updated_at timestamptz)
 RETURNS timestamptz LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
  SELECT greatest(
    p_updated_at,
    coalesce((SELECT max(greatest(c.created_at, c.edited_at))
                FROM task_comments c
               WHERE c.task_id = p_task_id AND c.deleted_at IS NULL), p_updated_at),
    coalesce((SELECT max(greatest(te.created_at, coalesce(te.ended_at, te.started_at, te.created_at)))
                FROM time_entries te
               WHERE te.task_id = p_task_id), p_updated_at)
  );
$function$;
REVOKE EXECUTE ON FUNCTION public.task_last_activity_at(uuid, timestamptz) FROM public, authenticated, anon;

-- Rewire the stale scan to use last-activity (edits OR comments OR time entries).
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
       AND task_last_activity_at(tk.id, tk.updated_at) < now() - make_interval(days => v_days)
    LOOP
      BEGIN
        CONTINUE WHEN NOT eval_task_automation_conditions(r.conditions, t);

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
