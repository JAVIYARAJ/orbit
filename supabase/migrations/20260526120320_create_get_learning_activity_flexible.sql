CREATE OR REPLACE FUNCTION get_learning_activity(
  p_workstation_id uuid,
  p_start_date     date DEFAULT NULL,
  p_end_date       date DEFAULT NULL
)
RETURNS TABLE(activity_date date, total_hours numeric)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ls.date             AS activity_date,
    SUM(ls.hours)::numeric AS total_hours
  FROM learning_sessions ls
  JOIN learning li ON li.id = ls.learning_id
  WHERE li.workstation_id = p_workstation_id
    AND (p_start_date IS NULL OR ls.date >= p_start_date)
    AND (p_end_date   IS NULL OR ls.date <= p_end_date)
  GROUP BY ls.date
  ORDER BY ls.date;
END;
$$;
