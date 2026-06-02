CREATE OR REPLACE FUNCTION public.get_weekly_learning_hours(p_workstation_id uuid)
RETURNS numeric LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  -- Hours from sessions logged this week
  SELECT COALESCE((
    SELECT SUM(s.hours)
    FROM learning_sessions s
    JOIN learning l ON l.id = s.learning_id
    WHERE l.workstation_id = p_workstation_id
      AND s.user_id = auth.uid()
      AND s.date >= date_trunc('week', CURRENT_DATE)
      AND s.date <  date_trunc('week', CURRENT_DATE) + interval '7 days'
  ), 0)
  +
  -- Est hours for items completed this week that have no sessions at all
  COALESCE((
    SELECT SUM(COALESCE(l.est_hours, 0))
    FROM learning l
    WHERE l.workstation_id = p_workstation_id
      AND l.user_id = auth.uid()
      AND l.status = 'completed'
      AND l.last_reviewed >= date_trunc('week', CURRENT_DATE)
      AND l.last_reviewed <  date_trunc('week', CURRENT_DATE) + interval '7 days'
      AND NOT EXISTS (
        SELECT 1 FROM learning_sessions s WHERE s.learning_id = l.id
      )
  ), 0);
$$;
