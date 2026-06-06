-- Table
CREATE TABLE IF NOT EXISTS public.task_status_logs (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id       uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  from_status_id uuid REFERENCES public.task_statuses(id) ON DELETE SET NULL,
  to_status_id   uuid REFERENCES public.task_statuses(id) ON DELETE SET NULL,
  changed_at    timestamptz DEFAULT now() NOT NULL,
  user_id       uuid NOT NULL DEFAULT auth.uid()
);

ALTER TABLE public.task_status_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workstation members can manage task status logs"
ON public.task_status_logs
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    JOIN public.workstation_members wm ON wm.workstation_id = t.workstation_id
    WHERE t.id = task_status_logs.task_id AND wm.user_id = auth.uid()
  )
);

-- Fetch RPC
CREATE OR REPLACE FUNCTION public.get_task_status_logs(p_task_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id',              tsl.id,
        'fromStatusLabel', fs.label,
        'fromStatusColor', fs.color,
        'toStatusLabel',   ts.label,
        'toStatusColor',   ts.color,
        'changedAt',       tsl.changed_at
      )
      ORDER BY tsl.changed_at DESC
    ),
    '[]'::jsonb
  )
  FROM public.task_status_logs tsl
  LEFT JOIN public.task_statuses fs ON fs.id = tsl.from_status_id
  LEFT JOIN public.task_statuses ts ON ts.id = tsl.to_status_id
  WHERE tsl.task_id = p_task_id;
$$;
