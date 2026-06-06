ALTER TABLE public.learning ADD COLUMN IF NOT EXISTS difficulty text DEFAULT NULL;

CREATE OR REPLACE FUNCTION public.create_learning_item(p_workstation_id uuid, p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM workstation_members
    WHERE workstation_id = p_workstation_id AND user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'Access denied'; END IF;

  INSERT INTO learning (
    workstation_id, user_id, topic, cat, status,
    est_hours, actual_hours, link, note,
    needs_review, progress, last_reviewed, difficulty
  ) VALUES (
    p_workstation_id, auth.uid(),
    p_data->>'topic',
    COALESCE(p_data->>'cat', ''),
    COALESCE(p_data->>'status', 'to_learn'),
    NULLIF(p_data->>'est_hours', '')::numeric,
    NULLIF(p_data->>'actual_hours', '')::numeric,
    COALESCE(p_data->>'link', ''),
    COALESCE(p_data->>'note', ''),
    COALESCE((p_data->>'needs_review')::boolean, false),
    COALESCE((p_data->>'progress')::integer, 0),
    NULLIF(p_data->>'last_reviewed', '')::date,
    NULLIF(p_data->>'difficulty', '')
  )
  RETURNING id INTO v_id;
  RETURN (SELECT row_to_json(l)::jsonb FROM learning l WHERE l.id = v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_learning_item(p_item_id uuid, p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE v_workstation_id uuid;
BEGIN
  SELECT workstation_id INTO v_workstation_id FROM learning WHERE id = p_item_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found or access denied'; END IF;

  UPDATE learning SET
    topic         = COALESCE(p_data->>'topic',          topic),
    cat           = COALESCE(p_data->>'cat',            cat),
    status        = COALESCE(p_data->>'status',         status),
    est_hours     = CASE WHEN p_data ? 'est_hours'     THEN NULLIF(p_data->>'est_hours',     '')::numeric  ELSE est_hours     END,
    actual_hours  = CASE WHEN p_data ? 'actual_hours'  THEN NULLIF(p_data->>'actual_hours',  '')::numeric  ELSE actual_hours  END,
    link          = COALESCE(p_data->>'link',           link),
    note          = COALESCE(p_data->>'note',           note),
    needs_review  = CASE WHEN p_data ? 'needs_review'  THEN (p_data->>'needs_review')::boolean             ELSE needs_review  END,
    progress      = CASE WHEN p_data ? 'progress'      THEN (p_data->>'progress')::integer                 ELSE progress      END,
    last_reviewed = CASE WHEN p_data ? 'last_reviewed' THEN NULLIF(p_data->>'last_reviewed', '')::date     ELSE last_reviewed END,
    difficulty    = CASE WHEN p_data ? 'difficulty'    THEN NULLIF(p_data->>'difficulty',    '')           ELSE difficulty    END
  WHERE id = p_item_id AND user_id = auth.uid();

  RETURN (SELECT row_to_json(l)::jsonb FROM learning l WHERE l.id = p_item_id);
END;
$$;
