-- 1. Tags table
CREATE TABLE tags (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workstation_id uuid NOT NULL REFERENCES workstations(id) ON DELETE CASCADE,
  name           text NOT NULL,
  color          text NOT NULL DEFAULT '#888888',
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workstation_id, name)
);

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tags_member_access" ON tags
  FOR ALL USING (
    workstation_id IN (
      SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid()
    )
  );

-- 2. Add tag_ids uuid[] to tasks
ALTER TABLE tasks ADD COLUMN tag_ids uuid[] NOT NULL DEFAULT '{}';

-- 3. Backfill: extract unique tag names per workstation → tags table
INSERT INTO tags (workstation_id, name)
SELECT DISTINCT t.workstation_id, tag_text
FROM tasks t, unnest(t.tags) AS tag_text
WHERE array_length(t.tags, 1) > 0
ON CONFLICT (workstation_id, name) DO NOTHING;

-- 4. Backfill tag_ids on tasks from text names → UUIDs
UPDATE tasks t
SET tag_ids = COALESCE(ARRAY(
  SELECT tg.id
  FROM unnest(t.tags) AS tag_text
  JOIN tags tg ON tg.workstation_id = t.workstation_id AND tg.name = tag_text
), '{}');

-- 5. Drop old text tags column
ALTER TABLE tasks DROP COLUMN tags;

-- 6. Rebuild create_task
CREATE OR REPLACE FUNCTION create_task(p_workstation_id uuid, p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row tasks%rowtype;
BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM workstation_members
    WHERE workstation_id = p_workstation_id AND user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'access_denied'; END IF;

  INSERT INTO tasks(
    user_id, workstation_id, task_id, project_short_id, status_id,
    priority, title, description, due_date, tag_ids, parent_task_id
  ) VALUES (
    auth.uid(), p_workstation_id,
    p_data->>'task_id',
    p_data->>'project_short_id',
    nullif(p_data->>'status_id', '')::uuid,
    (p_data->>'priority')::int,
    p_data->>'title',
    coalesce(p_data->>'description', ''),
    nullif(p_data->>'due_date', '')::date,
    (SELECT array_agg(x::uuid) FROM jsonb_array_elements_text(coalesce(p_data->'tag_ids', '[]')) x),
    nullif(p_data->>'parent_task_id', '')::uuid
  ) RETURNING * INTO v_row;

  RETURN row_to_json(v_row)::jsonb;
END;
$$;

-- 7. Rebuild update_task
CREATE OR REPLACE FUNCTION update_task(p_task_id text, p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row tasks%rowtype;
BEGIN
  UPDATE tasks SET
    status_id      = CASE
                       WHEN p_data ? 'status_id'
                       THEN nullif(p_data->>'status_id', '')::uuid
                       ELSE status_id
                     END,
    priority       = (p_data->>'priority')::int,
    title          = p_data->>'title',
    description    = coalesce(p_data->>'description', description),
    due_date       = nullif(p_data->>'due_date', '')::date,
    tag_ids        = (SELECT array_agg(x::uuid) FROM jsonb_array_elements_text(coalesce(p_data->'tag_ids', '[]')) x),
    parent_task_id = CASE
                       WHEN p_data ? 'parent_task_id'
                       THEN nullif(p_data->>'parent_task_id', '')::uuid
                       ELSE parent_task_id
                     END,
    updated_at     = now()
  WHERE task_id = p_task_id
    AND workstation_id IN (
      SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid()
    )
  RETURNING * INTO v_row;

  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  RETURN row_to_json(v_row)::jsonb;
END;
$$;

-- 8. Update load_workstation_data to include tags
CREATE OR REPLACE FUNCTION load_workstation_data(p_workstation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM workstation_members WHERE workstation_id = p_workstation_id AND user_id = auth.uid())
  THEN RAISE EXCEPTION 'access_denied'; END IF;

  RETURN jsonb_build_object(
    'statuses', (
      SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]')
      FROM (SELECT * FROM task_statuses WHERE workstation_id = p_workstation_id ORDER BY sort_order) r
    ),
    'project_types', (
      SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]')
      FROM (SELECT * FROM project_types WHERE workstation_id = p_workstation_id ORDER BY sort_order) r
    ),
    'tags', (
      SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]')
      FROM (SELECT * FROM tags WHERE workstation_id = p_workstation_id ORDER BY name) r
    ),
    'projects', (
      SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]')
      FROM (SELECT * FROM projects WHERE workstation_id = p_workstation_id ORDER BY created_at) r
    ),
    'tasks', (
      SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]')
      FROM (SELECT * FROM tasks WHERE workstation_id = p_workstation_id ORDER BY created_at) r
    ),
    'notes', (
      SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]')
      FROM (SELECT * FROM notes WHERE workstation_id = p_workstation_id ORDER BY pinned DESC, updated_at DESC) r
    ),
    'vault', (
      SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]')
      FROM (SELECT * FROM vault WHERE workstation_id = p_workstation_id ORDER BY updated_at DESC) r
    ),
    'learning', (
      SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]')
      FROM (SELECT * FROM learning WHERE workstation_id = p_workstation_id ORDER BY created_at) r
    ),
    'email_templates', (
      SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]')
      FROM (SELECT * FROM email_templates WHERE workstation_id = p_workstation_id ORDER BY created_at) r
    ),
    'gantt_tasks', (
      SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]')
      FROM (SELECT * FROM gantt_tasks WHERE workstation_id = p_workstation_id ORDER BY sort_order) r
    ),
    'timer_sessions', (
      SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb), '[]')
      FROM (SELECT * FROM timer_sessions WHERE workstation_id = p_workstation_id ORDER BY created_at) r
    )
  );
END;
$$;

-- 9. create_tag RPC
CREATE OR REPLACE FUNCTION create_tag(p_workstation_id uuid, p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row tags%rowtype;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM workstation_members WHERE workstation_id = p_workstation_id AND user_id = auth.uid())
  THEN RAISE EXCEPTION 'access_denied'; END IF;

  INSERT INTO tags(workstation_id, name, color)
  VALUES (p_workstation_id, p_data->>'name', coalesce(nullif(p_data->>'color',''), '#888888'))
  RETURNING * INTO v_row;

  RETURN row_to_json(v_row)::jsonb;
END;
$$;

-- 10. update_tag RPC
CREATE OR REPLACE FUNCTION update_tag(p_tag_id uuid, p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row tags%rowtype;
BEGIN
  UPDATE tags SET
    name  = coalesce(nullif(p_data->>'name',''),  name),
    color = coalesce(nullif(p_data->>'color',''), color)
  WHERE id = p_tag_id
    AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid())
  RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  RETURN row_to_json(v_row)::jsonb;
END;
$$;

-- 11. delete_tag RPC — also removes the tag from all tasks
CREATE OR REPLACE FUNCTION delete_tag(p_tag_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_ws uuid;
BEGIN
  SELECT workstation_id INTO v_ws FROM tags WHERE id = p_tag_id;

  IF NOT EXISTS(SELECT 1 FROM workstation_members WHERE workstation_id = v_ws AND user_id = auth.uid())
  THEN RAISE EXCEPTION 'access_denied'; END IF;

  -- Remove from all tasks in this workstation
  UPDATE tasks
  SET tag_ids = array_remove(tag_ids, p_tag_id)
  WHERE workstation_id = v_ws AND tag_ids @> ARRAY[p_tag_id];

  DELETE FROM tags WHERE id = p_tag_id;
END;
$$;
