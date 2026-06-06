-- Add description column
ALTER TABLE projects ADD COLUMN description text NOT NULL DEFAULT '';

-- Rebuild create_project to include description
CREATE OR REPLACE FUNCTION create_project(p_workstation_id uuid, p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row projects%rowtype;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM workstation_members
    WHERE workstation_id = p_workstation_id AND user_id = auth.uid())
  THEN RAISE EXCEPTION 'access_denied'; END IF;

  INSERT INTO projects(user_id, workstation_id, short_id, name, client, description, project_type_id,
    start_date, end_date, status, stack, progress, tasks_count, open_tasks,
    hours_logged, hours_est, repo, budget)
  VALUES (
    auth.uid(), p_workstation_id,
    p_data->>'short_id', p_data->>'name',
    coalesce(p_data->>'client',''),
    coalesce(p_data->>'description',''),
    nullif(p_data->>'project_type_id','')::uuid,
    nullif(p_data->>'start_date','')::date,
    nullif(p_data->>'end_date','')::date,
    p_data->>'status',
    (SELECT array_agg(x) FROM jsonb_array_elements_text(coalesce(p_data->'stack','[]')) x),
    (p_data->>'progress')::int,
    (p_data->>'tasks_count')::int,
    (p_data->>'open_tasks')::int,
    (p_data->>'hours_logged')::numeric,
    (p_data->>'hours_est')::numeric,
    coalesce(p_data->>'repo',''),
    coalesce(p_data->>'budget','')
  ) RETURNING * INTO v_row;
  RETURN row_to_json(v_row)::jsonb;
END;
$$;

-- Rebuild update_project to include description
CREATE OR REPLACE FUNCTION update_project(p_short_id text, p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row projects%rowtype;
BEGIN
  UPDATE projects SET
    name            = p_data->>'name',
    client          = coalesce(p_data->>'client',''),
    description     = coalesce(p_data->>'description',''),
    project_type_id = nullif(p_data->>'project_type_id','')::uuid,
    start_date      = nullif(p_data->>'start_date','')::date,
    end_date        = nullif(p_data->>'end_date','')::date,
    status          = p_data->>'status',
    stack           = (SELECT array_agg(x) FROM jsonb_array_elements_text(coalesce(p_data->'stack','[]')) x),
    progress        = (p_data->>'progress')::int,
    tasks_count     = (p_data->>'tasks_count')::int,
    open_tasks      = (p_data->>'open_tasks')::int,
    hours_logged    = (p_data->>'hours_logged')::numeric,
    hours_est       = (p_data->>'hours_est')::numeric,
    repo            = coalesce(p_data->>'repo',''),
    budget          = coalesce(p_data->>'budget','')
  WHERE short_id = p_short_id
    AND workstation_id IN (
      SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid()
    )
  RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  RETURN row_to_json(v_row)::jsonb;
END;
$$;
