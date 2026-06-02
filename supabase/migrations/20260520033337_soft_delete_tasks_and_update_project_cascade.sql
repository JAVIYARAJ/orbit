-- 1. Add deleted_at to tasks so we can soft-delete them
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Replace soft_delete_project: soft-delete project AND all its tasks
CREATE OR REPLACE FUNCTION public.soft_delete_project(p_short_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workstation_id UUID;
BEGIN
  SELECT workstation_id INTO v_workstation_id
  FROM public.projects
  WHERE short_id = p_short_id
    AND workstation_id IN (
      SELECT workstation_id FROM public.workstation_members WHERE user_id = auth.uid()
    )
    AND deleted_at IS NULL;

  IF v_workstation_id IS NULL THEN
    RAISE EXCEPTION 'Project not found or already deleted';
  END IF;

  -- Soft-delete the project
  UPDATE public.projects
  SET deleted_at = NOW()
  WHERE short_id = p_short_id;

  -- Soft-delete all tasks belonging to this project
  UPDATE public.tasks
  SET deleted_at = NOW()
  WHERE project_short_id = p_short_id
    AND workstation_id = v_workstation_id
    AND deleted_at IS NULL;
END;
$$;
