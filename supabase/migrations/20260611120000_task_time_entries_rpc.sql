-- ── get_task_time_entries — all members' logged time for one task ──
-- The existing get_time_entries() filters by user_id = auth.uid(), and the
-- te_own RLS policy on time_entries restricts rows to the caller. That makes a
-- task's "work log" tab only ever show the viewer's own entries. This RPC
-- returns every workstation member's completed entries for a given task so the
-- task panel can display who logged what. SECURITY DEFINER bypasses te_own; an
-- explicit membership guard keeps access limited to the task's workstation.
CREATE OR REPLACE FUNCTION public.get_task_time_entries(p_task_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_result jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tasks t
    JOIN public.workstation_members wm ON wm.workstation_id = t.workstation_id
    WHERE t.id = p_task_id AND wm.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'access_denied';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id',           te.id,
        'userId',       te.user_id,
        'totalSeconds', te.total_seconds,
        'notes',        te.notes,
        'isManual',     te.is_manual,
        'status',       te.status,
        'startedAt',    te.started_at,
        'endedAt',      te.ended_at,
        'createdAt',    te.created_at
      )
      ORDER BY te.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM public.time_entries te
  WHERE te.task_id = p_task_id
    AND te.status NOT IN ('running', 'paused');

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_task_time_entries(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_task_time_entries(uuid) TO authenticated;
