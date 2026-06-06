-- 1. Add deleted_at column to projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Soft-delete RPC: marks project as deleted, only if owned by caller
CREATE OR REPLACE FUNCTION public.soft_delete_project(p_short_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.projects
  SET deleted_at = NOW()
  WHERE short_id = p_short_id
    AND workstation_id IN (
      SELECT workstation_id
      FROM public.workstation_members
      WHERE user_id = auth.uid()
    )
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found or already deleted';
  END IF;
END;
$$;
