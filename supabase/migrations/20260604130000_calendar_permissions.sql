-- Enforce the `manage_calendar` permission on native calendar-event mutations,
-- and add it to has_workspace_permission's role defaults (admin + member: true,
-- viewer: false). Module visibility (`view_calendar`) is gated client-side.

CREATE OR REPLACE FUNCTION public.has_workspace_permission(p_workstation_id uuid, p_action text)
 RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_role     text;
  v_override boolean;
  v_default  boolean;
BEGIN
  SELECT role INTO v_role FROM workstation_members
   WHERE workstation_id = p_workstation_id AND user_id = auth.uid();

  IF v_role IS NULL THEN RETURN false; END IF;
  IF v_role = 'owner' THEN RETURN true;  END IF;

  SELECT allowed INTO v_override FROM workspace_role_permissions
   WHERE workstation_id = p_workstation_id AND role = v_role AND permission_key = p_action;
  IF FOUND THEN RETURN v_override; END IF;

  v_default := CASE
    WHEN v_role = 'admin' THEN CASE p_action
      WHEN 'create_project'  THEN true
      WHEN 'edit_project'    THEN true
      WHEN 'delete_project'  THEN false
      WHEN 'create_task'     THEN true
      WHEN 'edit_task'       THEN true
      WHEN 'delete_task'     THEN true
      WHEN 'assign_task'     THEN true
      WHEN 'manage_calendar' THEN true
      WHEN 'manage_vault'    THEN false
      WHEN 'view_vault'      THEN false
      WHEN 'invite_member'   THEN true
      WHEN 'remove_member'   THEN true
      WHEN 'change_role'     THEN false
      ELSE false
    END
    WHEN v_role = 'member' THEN CASE p_action
      WHEN 'create_task'     THEN true
      WHEN 'edit_task'       THEN true
      WHEN 'assign_task'     THEN true
      WHEN 'manage_calendar' THEN true
      ELSE false
    END
    ELSE false
  END;

  RETURN coalesce(v_default, false);
END;
$function$;

-- Mutations now require manage_calendar (membership is implied by the helper).
CREATE OR REPLACE FUNCTION public.create_calendar_event(p_workstation_id uuid, p_data jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_row calendar_events%rowtype;
BEGIN
  IF NOT has_workspace_permission(p_workstation_id, 'manage_calendar')
  THEN RAISE EXCEPTION 'permission_denied'; END IF;

  INSERT INTO calendar_events(workstation_id, title, description, location, starts_at, ends_at,
    all_day, color, project_short_id, created_by, updated_by)
  VALUES (p_workstation_id, p_data->>'title', coalesce(p_data->>'description',''),
    nullif(p_data->>'location',''), (p_data->>'starts_at')::timestamptz, (p_data->>'ends_at')::timestamptz,
    coalesce((p_data->>'all_day')::boolean, false), nullif(p_data->>'color',''),
    nullif(p_data->>'project_short_id',''), auth.uid(), auth.uid())
  RETURNING * INTO v_row;
  RETURN row_to_json(v_row)::jsonb;
END;
$function$;

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
    updated_at = now(), updated_by = auth.uid()
  WHERE id = p_id
  RETURNING * INTO v_row;

  UPDATE calendar_event_links SET sync_status = 'pending_push'
   WHERE workstation_id = v_row.workstation_id AND orbit_kind = 'event' AND orbit_id = v_row.id::text;

  RETURN row_to_json(v_row)::jsonb;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_calendar_event(p_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_ws uuid;
BEGIN
  SELECT workstation_id INTO v_ws FROM calendar_events
   WHERE id = p_id AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid());
  IF v_ws IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT has_workspace_permission(v_ws, 'manage_calendar') THEN RAISE EXCEPTION 'permission_denied'; END IF;

  UPDATE calendar_events SET deleted_at = now(), deleted_by = auth.uid() WHERE id = p_id;
  UPDATE calendar_event_links SET sync_status = 'deleted'
   WHERE workstation_id = v_ws AND orbit_kind = 'event' AND orbit_id = p_id::text;
END;
$function$;
