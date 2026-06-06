-- ════════════════════════════════════════════════════════════════════════════
-- Calendar feature: native Orbit events, Google sync mapping, and a display-only
-- cache of pulled Google events. Mirrors the existing RPC conventions
-- (SECURITY DEFINER, search_path=public, workstation_members membership guard).
-- ════════════════════════════════════════════════════════════════════════════

-- ── Native Orbit events (standalone, not tied to a task) ─────────────────────
CREATE TABLE IF NOT EXISTS calendar_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workstation_id   uuid NOT NULL REFERENCES workstations(id) ON DELETE CASCADE,
  title            text NOT NULL,
  description      text NOT NULL DEFAULT '',
  location         text,
  starts_at        timestamptz NOT NULL,
  ends_at          timestamptz NOT NULL,
  all_day          boolean NOT NULL DEFAULT false,
  color            text,
  project_short_id text,
  created_by       uuid REFERENCES auth.users(id),
  updated_by       uuid REFERENCES auth.users(id),
  deleted_by       uuid REFERENCES auth.users(id),
  deleted_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS calendar_events_ws_idx ON calendar_events (workstation_id) WHERE deleted_at IS NULL;

-- ── Sync mapping between any Orbit item and a Google event ───────────────────
CREATE TABLE IF NOT EXISTS calendar_event_links (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workstation_id     uuid NOT NULL REFERENCES workstations(id) ON DELETE CASCADE,
  orbit_kind         text NOT NULL CHECK (orbit_kind IN ('event','task','project')),
  orbit_id           text NOT NULL,
  google_calendar_id text NOT NULL DEFAULT 'primary',
  google_event_id    text NOT NULL,
  etag               text,
  direction          text NOT NULL DEFAULT 'two_way' CHECK (direction IN ('push','pull','two_way')),
  sync_status        text NOT NULL DEFAULT 'synced'
                     CHECK (sync_status IN ('synced','pending_push','pending_pull','error','deleted')),
  last_error         text,
  orbit_updated_at   timestamptz,
  google_updated_at  timestamptz,
  last_synced_at     timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workstation_id, orbit_kind, orbit_id),
  UNIQUE (workstation_id, google_calendar_id, google_event_id)
);
CREATE INDEX IF NOT EXISTS calendar_event_links_status_idx ON calendar_event_links (workstation_id, sync_status);

-- ── Display-only cache of Google events that have no Orbit counterpart ───────
CREATE TABLE IF NOT EXISTS google_calendar_cache (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workstation_id     uuid NOT NULL REFERENCES workstations(id) ON DELETE CASCADE,
  google_calendar_id text NOT NULL DEFAULT 'primary',
  google_event_id    text NOT NULL,
  summary            text,
  description        text,
  location           text,
  starts_at          timestamptz,
  ends_at            timestamptz,
  all_day            boolean NOT NULL DEFAULT false,
  html_link          text,
  etag               text,
  google_updated_at  timestamptz,
  status             text,
  fetched_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workstation_id, google_calendar_id, google_event_id)
);
CREATE INDEX IF NOT EXISTS google_calendar_cache_ws_idx ON google_calendar_cache (workstation_id);

-- ── RLS: workspace-member access (proxy/sync use the service role, bypassing RLS) ──
ALTER TABLE calendar_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_event_links  ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_calendar_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY ce_member ON calendar_events FOR ALL
  USING      (EXISTS (SELECT 1 FROM workstation_members wm WHERE wm.workstation_id = calendar_events.workstation_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workstation_members wm WHERE wm.workstation_id = calendar_events.workstation_id AND wm.user_id = auth.uid()));

CREATE POLICY cel_member ON calendar_event_links FOR ALL
  USING      (EXISTS (SELECT 1 FROM workstation_members wm WHERE wm.workstation_id = calendar_event_links.workstation_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workstation_members wm WHERE wm.workstation_id = calendar_event_links.workstation_id AND wm.user_id = auth.uid()));

CREATE POLICY gcc_member ON google_calendar_cache FOR ALL
  USING      (EXISTS (SELECT 1 FROM workstation_members wm WHERE wm.workstation_id = google_calendar_cache.workstation_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workstation_members wm WHERE wm.workstation_id = google_calendar_cache.workstation_id AND wm.user_id = auth.uid()));

-- ════════════════════════════════════════════════════════════════════════════
-- USER-FACING RPCs (called from the browser; guard on auth.uid() membership)
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.create_calendar_event(p_workstation_id uuid, p_data jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_row calendar_events%rowtype;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM workstation_members WHERE workstation_id = p_workstation_id AND user_id = auth.uid())
  THEN RAISE EXCEPTION 'access_denied'; END IF;

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
DECLARE v_row calendar_events%rowtype;
BEGIN
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
  WHERE id = p_id AND deleted_at IS NULL
    AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid())
  RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;

  -- Mark the Google link stale so the next sync pushes the change.
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

  UPDATE calendar_events SET deleted_at = now(), deleted_by = auth.uid() WHERE id = p_id;
  -- Tell the sync engine to remove the matching Google event.
  UPDATE calendar_event_links SET sync_status = 'deleted'
   WHERE workstation_id = v_ws AND orbit_kind = 'event' AND orbit_id = p_id::text;
END;
$function$;

-- Single round-trip read for the calendar page: native events + Google cache +
-- tasks-with-due_date + projects-with-dates that fall in the visible window.
CREATE OR REPLACE FUNCTION public.list_calendar_window(p_workstation_id uuid, p_from timestamptz, p_to timestamptz)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_result jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM workstation_members WHERE workstation_id = p_workstation_id AND user_id = auth.uid())
  THEN RAISE EXCEPTION 'access_denied'; END IF;

  SELECT jsonb_build_object(
    'events', coalesce((SELECT jsonb_agg(to_jsonb(e)) FROM calendar_events e
        WHERE e.workstation_id = p_workstation_id AND e.deleted_at IS NULL
          AND e.starts_at < p_to AND e.ends_at >= p_from), '[]'::jsonb),
    'google', coalesce((SELECT jsonb_agg(to_jsonb(g)) FROM google_calendar_cache g
        WHERE g.workstation_id = p_workstation_id AND coalesce(g.status,'confirmed') <> 'cancelled'
          AND g.starts_at < p_to AND g.ends_at >= p_from), '[]'::jsonb),
    'tasks', coalesce((SELECT jsonb_agg(jsonb_build_object(
          'id', t.id, 'task_id', t.task_id, 'title', t.title, 'due_date', t.due_date,
          'project_short_id', t.project_short_id, 'status_id', t.status_id,
          'priority_id', t.priority_id, 'assignee_id', t.assignee_id))
        FROM tasks t WHERE t.workstation_id = p_workstation_id AND t.deleted_at IS NULL
          AND t.due_date IS NOT NULL AND t.due_date >= p_from::date AND t.due_date <= p_to::date), '[]'::jsonb),
    'projects', coalesce((SELECT jsonb_agg(jsonb_build_object(
          'id', p.id, 'short_id', p.short_id, 'name', p.name, 'status', p.status,
          'start_date', p.start_date, 'end_date', p.end_date))
        FROM projects p WHERE p.workstation_id = p_workstation_id AND p.deleted_at IS NULL
          AND p.start_date IS NOT NULL
          AND p.start_date <= p_to::date AND coalesce(p.end_date, p.start_date) >= p_from::date), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_calendar_event(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_calendar_event(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_calendar_event(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_calendar_window(uuid, timestamptz, timestamptz) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- SYNC-HELPER RPCs (called only by the google-calendar-proxy edge function via
-- the service role; not exposed to authenticated users)
-- ════════════════════════════════════════════════════════════════════════════

-- Items that need pushing to Google: qualifying Orbit items missing/stale links,
-- plus links flagged for deletion or whose Orbit item no longer qualifies.
CREATE OR REPLACE FUNCTION public.get_pending_pushes(p_workstation_id uuid)
 RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH current_items AS (
    SELECT 'event'::text AS kind, e.id::text AS orbit_id, e.title, e.description, e.location,
           e.starts_at, e.ends_at, e.all_day, e.updated_at
      FROM calendar_events e
     WHERE e.workstation_id = p_workstation_id AND e.deleted_at IS NULL
    UNION ALL
    SELECT 'task', t.task_id, t.title, coalesce(t.description,''), NULL,
           t.due_date::timestamptz, t.due_date::timestamptz, true, t.updated_at
      FROM tasks t
     WHERE t.workstation_id = p_workstation_id AND t.deleted_at IS NULL AND t.due_date IS NOT NULL
    UNION ALL
    SELECT 'project', p.short_id, p.name, coalesce(p.description,''), NULL,
           p.start_date::timestamptz, (coalesce(p.end_date, p.start_date) + 1)::timestamptz, true, p.updated_at
      FROM projects p
     WHERE p.workstation_id = p_workstation_id AND p.deleted_at IS NULL AND p.start_date IS NOT NULL
  )
  SELECT coalesce(jsonb_agg(item), '[]'::jsonb) FROM (
    -- upserts: new or changed items
    SELECT jsonb_build_object(
             'kind', ci.kind, 'orbit_id', ci.orbit_id, 'title', ci.title,
             'description', ci.description, 'location', ci.location,
             'starts_at', ci.starts_at, 'ends_at', ci.ends_at, 'all_day', ci.all_day,
             'orbit_updated_at', ci.updated_at,
             'google_event_id', l.google_event_id, 'google_calendar_id', coalesce(l.google_calendar_id,'primary'),
             'etag', l.etag, 'deleted', false) AS item
      FROM current_items ci
      LEFT JOIN calendar_event_links l
        ON l.workstation_id = p_workstation_id AND l.orbit_kind = ci.kind AND l.orbit_id = ci.orbit_id
     WHERE l.id IS NULL
        OR l.orbit_updated_at IS DISTINCT FROM ci.updated_at
        OR l.sync_status IN ('pending_push','error')
    UNION ALL
    -- deletes: explicit deletes + links orphaned because the Orbit item no longer qualifies
    SELECT jsonb_build_object(
             'kind', l.orbit_kind, 'orbit_id', l.orbit_id,
             'google_event_id', l.google_event_id, 'google_calendar_id', l.google_calendar_id,
             'etag', l.etag, 'deleted', true) AS item
      FROM calendar_event_links l
      LEFT JOIN current_items ci ON ci.kind = l.orbit_kind AND ci.orbit_id = l.orbit_id
     WHERE l.workstation_id = p_workstation_id
       AND (l.sync_status = 'deleted' OR ci.orbit_id IS NULL)
  ) rows;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_event_link(p_workstation_id uuid, p_data jsonb)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO calendar_event_links(workstation_id, orbit_kind, orbit_id, google_calendar_id,
    google_event_id, etag, orbit_updated_at, google_updated_at, last_synced_at, sync_status)
  VALUES (p_workstation_id, p_data->>'orbit_kind', p_data->>'orbit_id',
    coalesce(p_data->>'google_calendar_id','primary'), p_data->>'google_event_id',
    nullif(p_data->>'etag',''), (p_data->>'orbit_updated_at')::timestamptz,
    nullif(p_data->>'google_updated_at','')::timestamptz, now(), 'synced')
  ON CONFLICT (workstation_id, orbit_kind, orbit_id) DO UPDATE SET
    google_calendar_id = excluded.google_calendar_id,
    google_event_id    = excluded.google_event_id,
    etag               = excluded.etag,
    orbit_updated_at   = excluded.orbit_updated_at,
    google_updated_at  = excluded.google_updated_at,
    last_synced_at     = now(),
    sync_status        = 'synced',
    last_error         = NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_event_link(p_workstation_id uuid, p_orbit_kind text, p_orbit_id text)
 RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
  DELETE FROM calendar_event_links
   WHERE workstation_id = p_workstation_id AND orbit_kind = p_orbit_kind AND orbit_id = p_orbit_id;
$function$;

CREATE OR REPLACE FUNCTION public.mark_link_error(p_workstation_id uuid, p_orbit_kind text, p_orbit_id text, p_error text)
 RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
  UPDATE calendar_event_links SET sync_status = 'error', last_error = p_error
   WHERE workstation_id = p_workstation_id AND orbit_kind = p_orbit_kind AND orbit_id = p_orbit_id;
$function$;

-- Bulk upsert pulled Google events into the display cache (cancelled => removed).
CREATE OR REPLACE FUNCTION public.upsert_google_cache(p_workstation_id uuid, p_events jsonb)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE ev jsonb;
BEGIN
  FOR ev IN SELECT * FROM jsonb_array_elements(coalesce(p_events,'[]'::jsonb)) LOOP
    IF coalesce(ev->>'status','confirmed') = 'cancelled' THEN
      DELETE FROM google_calendar_cache
       WHERE workstation_id = p_workstation_id
         AND google_calendar_id = coalesce(ev->>'google_calendar_id','primary')
         AND google_event_id = ev->>'google_event_id';
      CONTINUE;
    END IF;
    INSERT INTO google_calendar_cache(workstation_id, google_calendar_id, google_event_id, summary,
      description, location, starts_at, ends_at, all_day, html_link, etag, google_updated_at, status, fetched_at)
    VALUES (p_workstation_id, coalesce(ev->>'google_calendar_id','primary'), ev->>'google_event_id',
      ev->>'summary', ev->>'description', ev->>'location',
      nullif(ev->>'starts_at','')::timestamptz, nullif(ev->>'ends_at','')::timestamptz,
      coalesce((ev->>'all_day')::boolean, false), ev->>'html_link', nullif(ev->>'etag',''),
      nullif(ev->>'google_updated_at','')::timestamptz, ev->>'status', now())
    ON CONFLICT (workstation_id, google_calendar_id, google_event_id) DO UPDATE SET
      summary = excluded.summary, description = excluded.description, location = excluded.location,
      starts_at = excluded.starts_at, ends_at = excluded.ends_at, all_day = excluded.all_day,
      html_link = excluded.html_link, etag = excluded.etag, google_updated_at = excluded.google_updated_at,
      status = excluded.status, fetched_at = now();
  END LOOP;
END;
$function$;

-- Lock the sync helpers to the service role only.
REVOKE EXECUTE ON FUNCTION public.get_pending_pushes(uuid) FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.upsert_event_link(uuid, jsonb) FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_event_link(uuid, text, text) FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_link_error(uuid, text, text, text) FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.upsert_google_cache(uuid, jsonb) FROM public, authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_pushes(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_event_link(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_event_link(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_link_error(uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_google_cache(uuid, jsonb) TO service_role;
