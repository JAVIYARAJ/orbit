-- Calendar reminders: store a "remind me N minutes before" on native events and
-- a pg_cron job that turns due reminders into notifications for the event creator.

ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS remind_minutes   int,
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

-- create_calendar_event: now also stores remind_minutes.
CREATE OR REPLACE FUNCTION public.create_calendar_event(p_workstation_id uuid, p_data jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_row calendar_events%rowtype;
BEGIN
  IF NOT has_workspace_permission(p_workstation_id, 'manage_calendar')
  THEN RAISE EXCEPTION 'permission_denied'; END IF;

  INSERT INTO calendar_events(workstation_id, title, description, location, starts_at, ends_at,
    all_day, color, project_short_id, remind_minutes, created_by, updated_by)
  VALUES (p_workstation_id, p_data->>'title', coalesce(p_data->>'description',''),
    nullif(p_data->>'location',''), (p_data->>'starts_at')::timestamptz, (p_data->>'ends_at')::timestamptz,
    coalesce((p_data->>'all_day')::boolean, false), nullif(p_data->>'color',''),
    nullif(p_data->>'project_short_id',''), nullif(p_data->>'remind_minutes','')::int,
    auth.uid(), auth.uid())
  RETURNING * INTO v_row;
  RETURN row_to_json(v_row)::jsonb;
END;
$function$;

-- update_calendar_event: stores remind_minutes; re-arms the reminder (clears
-- reminder_sent_at) whenever the time or the reminder setting changes.
CREATE OR REPLACE FUNCTION public.update_calendar_event(p_id uuid, p_data jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_row calendar_events%rowtype; v_ws uuid;
BEGIN
  SELECT workstation_id INTO v_ws FROM calendar_events
   WHERE id = p_id AND deleted_at IS NULL
     AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid());
  IF v_ws IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT has_workspace_permission(v_ws, 'manage_calendar') THEN RAISE EXCEPTION 'permission_denied'; END IF;

  UPDATE calendar_events SET
    title            = coalesce(p_data->>'title', title),
    description      = coalesce(p_data->>'description', description),
    location         = CASE WHEN p_data ? 'location' THEN nullif(p_data->>'location','') ELSE location END,
    starts_at        = CASE WHEN p_data ? 'starts_at' THEN (p_data->>'starts_at')::timestamptz ELSE starts_at END,
    ends_at          = CASE WHEN p_data ? 'ends_at'   THEN (p_data->>'ends_at')::timestamptz   ELSE ends_at   END,
    all_day          = CASE WHEN p_data ? 'all_day'   THEN (p_data->>'all_day')::boolean        ELSE all_day   END,
    color            = CASE WHEN p_data ? 'color' THEN nullif(p_data->>'color','') ELSE color END,
    project_short_id = CASE WHEN p_data ? 'project_short_id' THEN nullif(p_data->>'project_short_id','') ELSE project_short_id END,
    remind_minutes   = CASE WHEN p_data ? 'remind_minutes' THEN nullif(p_data->>'remind_minutes','')::int ELSE remind_minutes END,
    reminder_sent_at = CASE WHEN (p_data ? 'remind_minutes') OR (p_data ? 'starts_at') THEN NULL ELSE reminder_sent_at END,
    updated_at = now(), updated_by = auth.uid()
  WHERE id = p_id
  RETURNING * INTO v_row;

  UPDATE calendar_event_links SET sync_status = 'pending_push'
   WHERE workstation_id = v_row.workstation_id AND orbit_kind = 'event' AND orbit_id = v_row.id::text;

  RETURN row_to_json(v_row)::jsonb;
END;
$function$;

-- Turns due reminders into notifications. Runs from pg_cron (no auth context).
CREATE OR REPLACE FUNCTION public.dispatch_calendar_reminders()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT id, created_by, title, starts_at, remind_minutes
      FROM calendar_events
     WHERE deleted_at IS NULL
       AND remind_minutes IS NOT NULL
       AND reminder_sent_at IS NULL
       AND created_by IS NOT NULL
       AND now() >= starts_at - make_interval(mins => remind_minutes)
       AND now() <  starts_at
  LOOP
    INSERT INTO notifications(id, user_id, actor_id, type, preview, created_at)
    VALUES (gen_random_uuid(), r.created_by, r.created_by, 'calendar_reminder',
      r.title || CASE WHEN r.remind_minutes <= 0 THEN ' is starting now'
                      ELSE ' starts in ' || r.remind_minutes || ' min' END,
      now());
    UPDATE calendar_events SET reminder_sent_at = now() WHERE id = r.id;
  END LOOP;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.dispatch_calendar_reminders() FROM public, authenticated;

-- Schedule it to run every minute (idempotent).
DO $$
BEGIN
  PERFORM cron.unschedule('calendar-reminders');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
SELECT cron.schedule('calendar-reminders', '* * * * *', $$ SELECT public.dispatch_calendar_reminders(); $$);
