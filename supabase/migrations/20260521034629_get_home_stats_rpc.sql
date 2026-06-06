CREATE OR REPLACE FUNCTION get_home_stats(p_workstation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today           date    := current_date;
  v_week_start      date    := date_trunc('week', current_date)::date;
  v_hours_this_week numeric := 0;
  v_hours_last_week numeric := 0;
  v_week_chart      jsonb   := '[]'::jsonb;
  v_streak_current  integer := 0;
  v_streak_best     integer := 0;
  v_check_day       date;
  v_active_days     date[];
  v_day             date;
  v_run             integer := 0;
  v_prev_day        date;
BEGIN
  -- ── Hours this week (completed entries, Mon→today) ───────────────
  SELECT ROUND(COALESCE(SUM(total_seconds), 0) / 3600.0, 1)
  INTO   v_hours_this_week
  FROM   time_entries
  WHERE  workstation_id = p_workstation_id
    AND  status         = 'completed'
    AND  started_at::date >= v_week_start
    AND  started_at::date <= v_today;

  -- ── Hours last week ──────────────────────────────────────────────
  SELECT ROUND(COALESCE(SUM(total_seconds), 0) / 3600.0, 1)
  INTO   v_hours_last_week
  FROM   time_entries
  WHERE  workstation_id = p_workstation_id
    AND  status         = 'completed'
    AND  started_at::date >= v_week_start - 7
    AND  started_at::date <  v_week_start;

  -- ── Per-day hours for current week (0=Mon … 6=Sun) ──────────────
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('dow', dow, 'hours', hours)
      ORDER BY dow
    ),
    '[]'::jsonb
  )
  INTO v_week_chart
  FROM (
    SELECT
      (EXTRACT(ISODOW FROM started_at)::int - 1) AS dow,
      ROUND(SUM(total_seconds) / 3600.0, 1)       AS hours
    FROM   time_entries
    WHERE  workstation_id = p_workstation_id
      AND  status         = 'completed'
      AND  started_at::date >= v_week_start
      AND  started_at::date <= v_today
    GROUP  BY dow
  ) sub;

  -- ── Current streak: consecutive days back from today ─────────────
  -- Counts any non-discarded entry (running session = today counts)
  v_check_day := v_today;
  LOOP
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM time_entries
      WHERE  workstation_id = p_workstation_id
        AND  status        <> 'discarded'
        AND  started_at::date = v_check_day
    );
    v_streak_current := v_streak_current + 1;
    v_check_day := v_check_day - 1;
  END LOOP;

  -- ── Personal-best streak ─────────────────────────────────────────
  SELECT array_agg(DISTINCT started_at::date ORDER BY started_at::date)
  INTO   v_active_days
  FROM   time_entries
  WHERE  workstation_id = p_workstation_id
    AND  status        <> 'discarded';

  IF v_active_days IS NOT NULL THEN
    v_run      := 0;
    v_prev_day := NULL;
    FOREACH v_day IN ARRAY v_active_days LOOP
      IF v_prev_day IS NULL OR v_day = v_prev_day + 1 THEN
        v_run := v_run + 1;
      ELSE
        v_run := 1;
      END IF;
      IF v_run > v_streak_best THEN v_streak_best := v_run; END IF;
      v_prev_day := v_day;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'hours_this_week', v_hours_this_week,
    'hours_last_week', v_hours_last_week,
    'week_chart',      v_week_chart,
    'streak_current',  v_streak_current,
    'streak_best',     v_streak_best
  );
END;
$$;
