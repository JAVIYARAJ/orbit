CREATE OR REPLACE FUNCTION create_learning_item(
  p_workstation_id uuid,
  p_data jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM workstation_members
    WHERE workstation_id = p_workstation_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  INSERT INTO learning (
    workstation_id, topic, cat, status,
    est_hours, actual_hours, link, note,
    needs_review, progress, last_reviewed
  ) VALUES (
    p_workstation_id,
    p_data->>'topic',
    COALESCE(p_data->>'cat', ''),
    COALESCE(p_data->>'status', 'to_learn'),
    NULLIF(p_data->>'est_hours', '')::numeric,
    NULLIF(p_data->>'actual_hours', '')::numeric,
    COALESCE(p_data->>'link', ''),
    COALESCE(p_data->>'note', ''),
    COALESCE((p_data->>'needs_review')::boolean, false),
    COALESCE((p_data->>'progress')::integer, 0),
    NULLIF(p_data->>'last_reviewed', '')::date
  )
  RETURNING id INTO v_id;

  RETURN (SELECT row_to_json(l)::jsonb FROM learning l WHERE l.id = v_id);
END;
$$;

GRANT EXECUTE ON FUNCTION create_learning_item(uuid, jsonb) TO authenticated;
