CREATE OR REPLACE FUNCTION get_learning_week_activity(
  p_workstation_id uuid,
  p_week_start     date DEFAULT NULL
)
RETURNS TABLE(day_date date, total_hours numeric)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_week_start date;
BEGIN
  -- Default to current ISO week Monday
  IF p_week_start IS NULL THEN
    v_week_start := DATE_TRUNC('week', CURRENT_DATE)::date;
  ELSE
    v_week_start := p_week_start;
  END IF;

  RETURN QUERY
  SELECT
    gs.day::date                             AS day_date,
    COALESCE(SUM(ls.hours), 0)::numeric      AS total_hours
  FROM generate_series(
    v_week_start,
    v_week_start + INTERVAL '6 days',
    '1 day'::interval
  ) AS gs(day)
  LEFT JOIN learning_items li
    ON  li.workstation_id = p_workstation_id
    AND li.deleted_at IS NULL
  LEFT JOIN learning_sessions ls
    ON  ls.learning_id   = li.id
    AND ls.logged_at::date = gs.day::date
  GROUP BY gs.day
  ORDER BY gs.day;
END;
$$;
