-- Sessions table
CREATE TABLE IF NOT EXISTS public.learning_sessions (
  id          uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  learning_id uuid    NOT NULL REFERENCES public.learning(id) ON DELETE CASCADE,
  user_id     uuid    NOT NULL,
  date        date    NOT NULL DEFAULT CURRENT_DATE,
  hours       numeric NOT NULL DEFAULT 0,
  note        text    DEFAULT '',
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE public.learning_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own sessions" ON public.learning_sessions FOR ALL USING (user_id = auth.uid());

-- create session + auto-update actual_hours
CREATE OR REPLACE FUNCTION public.create_learning_session(
  p_learning_id uuid, p_hours numeric, p_note text DEFAULT '', p_date date DEFAULT CURRENT_DATE
) RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE v_sid uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM learning WHERE id = p_learning_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  INSERT INTO learning_sessions (learning_id, user_id, date, hours, note)
  VALUES (p_learning_id, auth.uid(), p_date, p_hours, COALESCE(p_note,''))
  RETURNING id INTO v_sid;
  UPDATE learning SET actual_hours = (
    SELECT COALESCE(SUM(hours),0) FROM learning_sessions WHERE learning_id = p_learning_id
  ) WHERE id = p_learning_id;
  RETURN jsonb_build_object(
    'session',  (SELECT row_to_json(s)::jsonb FROM learning_sessions s WHERE s.id = v_sid),
    'learning', (SELECT row_to_json(l)::jsonb FROM learning l WHERE l.id = p_learning_id)
  );
END;
$$;

-- list sessions for an item
CREATE OR REPLACE FUNCTION public.list_learning_sessions(p_learning_id uuid)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM learning WHERE id = p_learning_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  RETURN COALESCE(
    (SELECT jsonb_agg(row_to_json(s) ORDER BY s.date DESC, s.created_at DESC)
     FROM learning_sessions s WHERE s.learning_id = p_learning_id AND s.user_id = auth.uid()),
    '[]'::jsonb
  );
END;
$$;

-- delete session + recalculate actual_hours
CREATE OR REPLACE FUNCTION public.delete_learning_session(p_session_id uuid)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE v_lid uuid;
BEGIN
  SELECT learning_id INTO v_lid FROM learning_sessions WHERE id = p_session_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;
  DELETE FROM learning_sessions WHERE id = p_session_id AND user_id = auth.uid();
  UPDATE learning SET actual_hours = (
    SELECT COALESCE(SUM(hours),0) FROM learning_sessions WHERE learning_id = v_lid
  ) WHERE id = v_lid;
  RETURN (SELECT row_to_json(l)::jsonb FROM learning l WHERE l.id = v_lid);
END;
$$;

-- weekly hours for this workstation (Mon–Sun current week)
CREATE OR REPLACE FUNCTION public.get_weekly_learning_hours(p_workstation_id uuid)
RETURNS numeric LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE(SUM(s.hours), 0)
  FROM learning_sessions s
  JOIN learning l ON l.id = s.learning_id
  WHERE l.workstation_id = p_workstation_id
    AND s.user_id = auth.uid()
    AND s.date >= date_trunc('week', CURRENT_DATE)
    AND s.date <  date_trunc('week', CURRENT_DATE) + interval '7 days';
$$;
