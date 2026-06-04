-- Remove cached Google events that no longer exist in Google for the synced
-- window. A normal delete in Google just omits the event from the events list
-- (it isn't returned as 'cancelled'), so the pull pass passes the set of event
-- ids it DID see and this prunes any stale cache rows in range. Service-role only.

CREATE OR REPLACE FUNCTION public.prune_google_cache(p_workstation_id uuid, p_from timestamptz, p_to timestamptz, p_keep text[])
 RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
  DELETE FROM google_calendar_cache
   WHERE workstation_id = p_workstation_id
     AND starts_at < p_to
     AND coalesce(ends_at, starts_at) >= p_from
     AND NOT (google_event_id = ANY (coalesce(p_keep, ARRAY[]::text[])));
$function$;

REVOKE EXECUTE ON FUNCTION public.prune_google_cache(uuid, timestamptz, timestamptz, text[]) FROM public, authenticated;
GRANT  EXECUTE ON FUNCTION public.prune_google_cache(uuid, timestamptz, timestamptz, text[]) TO service_role;
