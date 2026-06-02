CREATE OR REPLACE FUNCTION public.te_json(p_entry_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
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
    'isManual',     te.is_manual,
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
$function$;
