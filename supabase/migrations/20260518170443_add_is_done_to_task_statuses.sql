-- 1. Add is_done column
ALTER TABLE task_statuses ADD COLUMN is_done boolean NOT NULL DEFAULT false;

-- 2. Seed existing 'done' keyed statuses
UPDATE task_statuses SET is_done = true WHERE key = 'done';

-- 3. Partial unique index: only one is_done=true per workstation
CREATE UNIQUE INDEX task_statuses_one_done_per_workstation
  ON task_statuses (workstation_id)
  WHERE is_done = true;

-- 4. Replace create_task_status — honours is_done, unsets others if true
CREATE OR REPLACE FUNCTION create_task_status(p_workstation_id uuid, p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_row   task_statuses%rowtype;
  v_max   integer;
  v_done  boolean;
BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM workstation_members
    WHERE workstation_id = p_workstation_id AND user_id = auth.uid() AND role IN ('owner','admin')
  ) THEN RAISE EXCEPTION 'access_denied'; END IF;

  v_done := COALESCE((p_data->>'is_done')::boolean, false);
  SELECT COALESCE(MAX(sort_order) + 1, 0) INTO v_max
    FROM task_statuses WHERE workstation_id = p_workstation_id;

  IF v_done THEN
    UPDATE task_statuses SET is_done = false WHERE workstation_id = p_workstation_id;
  END IF;

  INSERT INTO task_statuses (workstation_id, key, label, color, sort_order, is_done)
  VALUES (
    p_workstation_id,
    p_data->>'key',
    p_data->>'label',
    COALESCE(p_data->>'color', '#888888'),
    COALESCE((p_data->>'sort_order')::int, v_max),
    v_done
  )
  RETURNING * INTO v_row;

  RETURN row_to_json(v_row)::jsonb;
END;
$$;

-- 5. Replace update_task_status — honours is_done, unsets others if true
CREATE OR REPLACE FUNCTION update_task_status(p_status_id uuid, p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_row       task_statuses%rowtype;
  v_ws_id     uuid;
  v_done      boolean;
BEGIN
  SELECT workstation_id INTO v_ws_id
    FROM task_statuses WHERE id = p_status_id;

  IF NOT EXISTS(
    SELECT 1 FROM workstation_members
    WHERE workstation_id = v_ws_id AND user_id = auth.uid() AND role IN ('owner','admin')
  ) THEN RAISE EXCEPTION 'access_denied'; END IF;

  v_done := (p_data->>'is_done')::boolean;

  IF v_done IS NOT NULL AND v_done = true THEN
    UPDATE task_statuses SET is_done = false WHERE workstation_id = v_ws_id;
  END IF;

  UPDATE task_statuses SET
    label   = COALESCE(p_data->>'label',   label),
    color   = COALESCE(p_data->>'color',   color),
    is_done = COALESCE(v_done,             is_done)
  WHERE id = p_status_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  RETURN row_to_json(v_row)::jsonb;
END;
$$;
