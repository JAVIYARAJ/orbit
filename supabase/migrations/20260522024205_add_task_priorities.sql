-- ─── 1. Create task_priorities table ───────────────────────────────
CREATE TABLE public.task_priorities (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workstation_id uuid NOT NULL REFERENCES public.workstations(id) ON DELETE CASCADE,
  label        text NOT NULL,
  color        text NOT NULL DEFAULT '#888888',
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.task_priorities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view priorities"
  ON public.task_priorities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workstation_members wm
      WHERE wm.workstation_id = task_priorities.workstation_id
        AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "members can manage priorities"
  ON public.task_priorities FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workstation_members wm
      WHERE wm.workstation_id = task_priorities.workstation_id
        AND wm.user_id = auth.uid()
    )
  );

-- ─── 2. Seed default priorities for every existing workstation ──────
INSERT INTO public.task_priorities (workstation_id, label, color, sort_order)
SELECT id, 'Critical', '#ef4444', 1 FROM public.workstations
UNION ALL
SELECT id, 'Normal',   '#ff9500', 2 FROM public.workstations
UNION ALL
SELECT id, 'Low',      '#7a7a88', 3 FROM public.workstations;

-- ─── 3. Add priority_id UUID column to tasks ────────────────────────
ALTER TABLE public.tasks ADD COLUMN priority_id uuid REFERENCES public.task_priorities(id) ON DELETE SET NULL;

-- ─── 4. Migrate existing integer priorities to new UUIDs ────────────
-- For each workstation, map integer 1→Critical, 2→Normal, 3→Low
UPDATE public.tasks t
SET priority_id = tp.id
FROM public.task_priorities tp
WHERE tp.workstation_id = t.workstation_id
  AND (
    (t.priority = 1 AND tp.label = 'Critical') OR
    (t.priority = 2 AND tp.label = 'Normal')   OR
    (t.priority = 3 AND tp.label = 'Low')
  );

-- ─── 5. Drop old integer priority column ────────────────────────────
ALTER TABLE public.tasks DROP COLUMN priority;
