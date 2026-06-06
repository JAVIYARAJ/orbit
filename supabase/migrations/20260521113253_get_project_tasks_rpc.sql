CREATE OR REPLACE FUNCTION get_project_tasks(
  p_workstation_id   uuid,
  p_project_short_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id',               t.id,
      'task_id',          t.task_id,
      'project_short_id', t.project_short_id,
      'status_id',        t.status_id,
      'priority',         t.priority,
      'title',            t.title,
      'description',      t.description,
      'due_date',         t.due_date,
      'tag_ids',          t.tag_ids,
      'parent_task_id',   t.parent_task_id,
      'est_minutes',      t.est_minutes,
      'logged_minutes',   t.logged_minutes,
      'gh_branch',        t.gh_branch,
      'deleted_at',       t.deleted_at,
      'created_at',       t.created_at
    )
  )
  INTO v_result
  FROM tasks t
  WHERE t.workstation_id   = p_workstation_id
    AND t.project_short_id = p_project_short_id
    AND t.deleted_at       IS NULL;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;
