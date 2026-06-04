-- Two-way for native events: apply a Google-side edit of an Orbit-owned event
-- back into calendar_events, and re-stamp the link so it isn't re-pushed.
-- Service-role only (called by the google-calendar-proxy sync engine).

CREATE OR REPLACE FUNCTION public.apply_google_to_event(p_workstation_id uuid, p_data jsonb)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_upd timestamptz;
BEGIN
  UPDATE calendar_events SET
    title       = coalesce(p_data->>'title', title),
    description = coalesce(p_data->>'description', description),
    location    = nullif(p_data->>'location',''),
    starts_at   = coalesce(nullif(p_data->>'starts_at','')::timestamptz, starts_at),
    ends_at     = coalesce(nullif(p_data->>'ends_at','')::timestamptz, ends_at),
    all_day     = coalesce((p_data->>'all_day')::boolean, all_day),
    updated_at  = now()
  WHERE id = (p_data->>'orbit_id')::uuid
    AND workstation_id = p_workstation_id
    AND deleted_at IS NULL
  RETURNING updated_at INTO v_upd;

  IF v_upd IS NULL THEN RETURN; END IF;

  -- Mark the link synced at the new Orbit timestamp so the next run won't
  -- treat this Google-originated change as a pending Orbit push.
  UPDATE calendar_event_links SET
    orbit_updated_at  = v_upd,
    google_updated_at = nullif(p_data->>'google_updated_at','')::timestamptz,
    etag              = nullif(p_data->>'etag',''),
    last_synced_at    = now(),
    sync_status       = 'synced'
  WHERE workstation_id = p_workstation_id AND orbit_kind = 'event' AND orbit_id = p_data->>'orbit_id';
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.apply_google_to_event(uuid, jsonb) FROM public, authenticated;
GRANT  EXECUTE ON FUNCTION public.apply_google_to_event(uuid, jsonb) TO service_role;
