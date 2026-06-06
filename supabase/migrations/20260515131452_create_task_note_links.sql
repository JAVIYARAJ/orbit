-- Junction table: links notes to tasks
CREATE TABLE IF NOT EXISTS task_note_links (
  task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  note_id    UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (task_id, note_id)
);

ALTER TABLE task_note_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage task note links"
  ON task_note_links
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN workstation_members wm ON wm.workstation_id = t.workstation_id
      WHERE t.id = task_note_links.task_id
        AND wm.user_id = auth.uid()
    )
  );

-- RPC: link a note to a task
CREATE OR REPLACE FUNCTION link_note_to_task(p_task_id UUID, p_note_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM tasks t
    JOIN workstation_members wm ON wm.workstation_id = t.workstation_id
    WHERE t.id = p_task_id AND wm.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  INSERT INTO task_note_links (task_id, note_id)
  VALUES (p_task_id, p_note_id)
  ON CONFLICT DO NOTHING;
END;
$$;

-- RPC: unlink a note from a task
CREATE OR REPLACE FUNCTION unlink_note_from_task(p_task_id UUID, p_note_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM tasks t
    JOIN workstation_members wm ON wm.workstation_id = t.workstation_id
    WHERE t.id = p_task_id AND wm.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  DELETE FROM task_note_links WHERE task_id = p_task_id AND note_id = p_note_id;
END;
$$;

-- RPC: get all task-note links for a workstation
CREATE OR REPLACE FUNCTION get_task_note_links(p_workstation_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT COALESCE(
    JSON_AGG(JSON_BUILD_OBJECT(
      'task_id', tnl.task_id::text,
      'note_id', tnl.note_id::text
    )),
    '[]'::JSON
  )
  INTO result
  FROM task_note_links tnl
  JOIN tasks t ON t.id = tnl.task_id
  WHERE t.workstation_id = p_workstation_id
    AND t.user_id = auth.uid();
  RETURN result;
END;
$$;
