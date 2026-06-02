-- ╔══════════════════════════════════════════════════════════════╗
-- ║  TIME TRACKING — Helper + RPCs                               ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ── Helper: build full entry JSON with events + names ─────────────
CREATE OR REPLACE FUNCTION public.te_json(p_entry_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT jsonb_build_object(
    'id',           te.id,
    'projectId',    te.project_id,
    'projectName',  p.name,
    'projectShort', p.short_id,
    'taskId',       te.task_id,
    'taskTitle',    t.title,
    'taskShort',    t.task_id,
    'status',       te.status,
    'totalSeconds', te.total_seconds,
    'notes',        te.notes,
    'startedAt',    te.started_at,
    'endedAt',      te.ended_at,
    'events', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',      ev.id,
          'event',   ev.event,
          'at',      ev.happened_at,
          'elapsed', ev.elapsed_seconds
        ) ORDER BY ev.happened_at
      )
      FROM public.time_entry_events ev
      WHERE ev.entry_id = te.id
    ), '[]'::jsonb)
  )
  FROM  public.time_entries te
  JOIN  public.projects p  ON p.id = te.project_id
  LEFT JOIN public.tasks t ON t.id = te.task_id
  WHERE te.id = p_entry_id;
$$;

-- ── start_time_entry ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.start_time_entry(
  p_workstation_id uuid,
  p_project_id     uuid,
  p_task_id        uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.time_entries (workstation_id, user_id, project_id, task_id, status)
  VALUES (p_workstation_id, auth.uid(), p_project_id, p_task_id, 'running')
  RETURNING id INTO v_id;

  INSERT INTO public.time_entry_events (entry_id, event, elapsed_seconds)
  VALUES (v_id, 'start', 0);

  RETURN public.te_json(v_id);
END; $$;

-- ── pause_time_entry ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pause_time_entry(
  p_entry_id        uuid,
  p_elapsed_seconds integer DEFAULT 0
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.time_entries
  SET status        = 'paused',
      total_seconds = total_seconds + p_elapsed_seconds
  WHERE id = p_entry_id AND user_id = auth.uid();

  INSERT INTO public.time_entry_events (entry_id, event, elapsed_seconds)
  VALUES (p_entry_id, 'pause', p_elapsed_seconds);

  RETURN public.te_json(p_entry_id);
END; $$;

-- ── resume_time_entry ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.resume_time_entry(
  p_entry_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.time_entries
  SET status = 'running'
  WHERE id = p_entry_id AND user_id = auth.uid();

  INSERT INTO public.time_entry_events (entry_id, event, elapsed_seconds)
  VALUES (p_entry_id, 'resume', 0);

  RETURN public.te_json(p_entry_id);
END; $$;

-- ── complete_time_entry ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.complete_time_entry(
  p_entry_id        uuid,
  p_elapsed_seconds integer DEFAULT 0,
  p_notes           text    DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_total integer;
  v_pid   uuid;
BEGIN
  UPDATE public.time_entries
  SET status        = 'completed',
      total_seconds = total_seconds + p_elapsed_seconds,
      notes         = p_notes,
      ended_at      = now()
  WHERE id = p_entry_id AND user_id = auth.uid()
  RETURNING total_seconds, project_id INTO v_total, v_pid;

  INSERT INTO public.time_entry_events (entry_id, event, elapsed_seconds)
  VALUES (p_entry_id, 'complete', p_elapsed_seconds);

  -- Roll hours up to the project
  UPDATE public.projects
  SET hours_logged = COALESCE(hours_logged, 0) + ROUND(v_total::numeric / 3600, 4)
  WHERE id = v_pid;

  RETURN public.te_json(p_entry_id);
END; $$;

-- ── discard_time_entry ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.discard_time_entry(
  p_entry_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.time_entries
  WHERE id = p_entry_id AND user_id = auth.uid();
END; $$;

-- ── get_time_entries — recent completed/discarded history ─────────
CREATE OR REPLACE FUNCTION public.get_time_entries(
  p_workstation_id uuid,
  p_limit          integer DEFAULT 100
) RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COALESCE(
    jsonb_agg(public.te_json(sub.id) ORDER BY sub.created_at DESC),
    '[]'::jsonb
  )
  FROM (
    SELECT id, created_at FROM public.time_entries
    WHERE workstation_id = p_workstation_id
      AND user_id        = auth.uid()
      AND status         NOT IN ('running','paused')
    ORDER BY created_at DESC
    LIMIT p_limit
  ) sub;
$$;

-- ── get_active_time_entry — running or paused entry if any ────────
CREATE OR REPLACE FUNCTION public.get_active_time_entry(
  p_workstation_id uuid
) RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $$
  SELECT public.te_json(te.id)
  FROM public.time_entries te
  WHERE te.workstation_id = p_workstation_id
    AND te.user_id        = auth.uid()
    AND te.status         IN ('running', 'paused')
  ORDER BY te.created_at DESC
  LIMIT 1;
$$;
