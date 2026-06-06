-- Calendar reminders carry entity fields (so the bell routes them like the rest),
-- and a new daily job notifies assignees of due/overdue tasks.

CREATE OR REPLACE FUNCTION public.dispatch_calendar_reminders()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT id, workstation_id, created_by, title, recurrence_rule, starts_at, reminder_next_at, remind_minutes
      FROM calendar_events
     WHERE deleted_at IS NULL
       AND reminder_next_at IS NOT NULL
       AND remind_minutes IS NOT NULL
       AND created_by IS NOT NULL
       AND now() >= reminder_next_at - make_interval(mins => remind_minutes)
       AND now() <= reminder_next_at + interval '1 minute'
  LOOP
    INSERT INTO notifications(id, user_id, actor_id, type, workstation_id, entity_type, entity_id, title, preview, created_at)
    VALUES (gen_random_uuid(), r.created_by, r.created_by, 'calendar_reminder', r.workstation_id,
      'event', r.id::text, r.title,
      r.title || CASE WHEN r.remind_minutes <= 0 THEN ' is starting now'
                      ELSE ' starts in ' || r.remind_minutes || ' min' END,
      now());

    IF r.recurrence_rule IS NULL THEN
      UPDATE calendar_events SET reminder_next_at = NULL WHERE id = r.id;
    ELSE
      UPDATE calendar_events
         SET reminder_next_at = calendar_next_occurrence(r.recurrence_rule, r.starts_at, r.reminder_next_at)
       WHERE id = r.id;
    END IF;
  END LOOP;
END;
$function$;

-- Daily: notify the assignee of every non-done task that's due today or overdue,
-- once per task per day.
CREATE OR REPLACE FUNCTION public.dispatch_due_soon()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT t.id, t.title, t.assignee_id, t.workstation_id, t.due_date
      FROM tasks t
      LEFT JOIN task_statuses s ON s.id = t.status_id
     WHERE t.deleted_at IS NULL
       AND t.assignee_id IS NOT NULL
       AND t.due_date IS NOT NULL
       AND t.due_date <= current_date
       AND coalesce(s.is_done, false) = false
       AND NOT EXISTS (
         SELECT 1 FROM notifications n
          WHERE n.type = 'task_due_soon' AND n.user_id = t.assignee_id
            AND n.entity_id = t.id::text AND n.created_at::date = current_date)
  LOOP
    PERFORM public.notify(r.assignee_id, NULL, 'task_due_soon', r.workstation_id,
      'task', r.id::text, r.title,
      CASE WHEN r.due_date < current_date THEN 'Overdue' ELSE 'Due today' END);
  END LOOP;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.dispatch_due_soon() FROM public, authenticated;

DO $$
BEGIN
  PERFORM cron.unschedule('task-due-soon');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
SELECT cron.schedule('task-due-soon', '0 8 * * *', $$ SELECT public.dispatch_due_soon(); $$);
