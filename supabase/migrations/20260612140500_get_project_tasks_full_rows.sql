-- get_project_tasks built an explicit jsonb object that silently dropped
-- assignee_id, reporter_id and the audit stamps — so filtering the board by a
-- single project lost those fields. Return full rows (row_to_json over SELECT *)
-- to match load_workstation_data and keep the task shape in one place.

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
  SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb ORDER BY r.created_at), '[]')
    INTO v_result
    FROM (
      SELECT * FROM tasks
       WHERE workstation_id   = p_workstation_id
         AND project_short_id = p_project_short_id
         AND deleted_at       IS NULL
    ) r;

  RETURN v_result;
END;
$$;
