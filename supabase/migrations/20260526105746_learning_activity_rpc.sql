-- Returns daily session hours for the past year (for activity heatmap)
CREATE OR REPLACE FUNCTION get_learning_activity(p_workstation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM workstation_members
    WHERE workstation_id = p_workstation_id AND user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'access_denied'; END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object('date', r.date::text, 'hours', r.hours)
      ORDER BY r.date
    )
    FROM (
      SELECT ls.date, ROUND(SUM(ls.hours)::numeric, 2)::float AS hours
      FROM learning_sessions ls
      JOIN learning l ON l.id = ls.learning_id
      WHERE l.workstation_id = p_workstation_id
        AND ls.date >= CURRENT_DATE - INTERVAL '365 days'
      GROUP BY ls.date
    ) r
  ), '[]'::jsonb);
END;
$$;
