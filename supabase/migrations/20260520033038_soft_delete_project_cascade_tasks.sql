-- Replace soft_delete_project to also hard-delete all project tasks
CREATE OR REPLACE FUNCTION public.soft_delete_project(p_short_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workstation_id UUID;
BEGIN
  -- Resolve workstation and verify ownership
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

  -- Hard-delete all tasks that belong to this project
  DELETE FROM public.tasks
  WHERE project_short_id = p_short_id
    AND workstation_id = v_workstation_id;
END;
$$;
