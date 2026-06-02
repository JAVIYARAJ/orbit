-- Table
CREATE TABLE note_annotations (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id        uuid        NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  workstation_id uuid        NOT NULL REFERENCES workstations(id) ON DELETE CASCADE,
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  anchor_index   integer     NOT NULL,
  text           text        NOT NULL,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE note_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workstation_member_access" ON note_annotations
  USING (workstation_id IN (
    SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid()
  ))
  WITH CHECK (workstation_id IN (
    SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid()
  ));

-- RPC: get annotations for a note
CREATE OR REPLACE FUNCTION get_note_annotations(p_note_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM notes n
    JOIN workstation_members wm ON wm.workstation_id = n.workstation_id
    WHERE n.id = p_note_id AND wm.user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'access_denied'; END IF;

  RETURN COALESCE(
    (SELECT jsonb_agg(row_to_json(r)::jsonb ORDER BY r.created_at)
     FROM note_annotations r WHERE r.note_id = p_note_id),
    '[]'::jsonb
  );
END;
$$;

-- RPC: save (insert) a new annotation
CREATE OR REPLACE FUNCTION save_note_annotation(
  p_note_id        uuid,
  p_workstation_id uuid,
  p_anchor_index   integer,
  p_text           text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE result jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM workstation_members
    WHERE workstation_id = p_workstation_id AND user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'access_denied'; END IF;

  INSERT INTO note_annotations(note_id, workstation_id, user_id, anchor_index, text)
  VALUES (p_note_id, p_workstation_id, auth.uid(), p_anchor_index, p_text)
  RETURNING row_to_json(note_annotations.*)::jsonb INTO result;

  RETURN result;
END;
$$;

-- RPC: delete an annotation
CREATE OR REPLACE FUNCTION delete_note_annotation(p_annotation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM note_annotations
  WHERE id = p_annotation_id
    AND workstation_id IN (
      SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid()
    );
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
END;
$$;
