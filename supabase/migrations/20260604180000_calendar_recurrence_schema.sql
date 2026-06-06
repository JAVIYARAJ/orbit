-- Recurring native events: store an RRULE on the event and unify reminder timing
-- under a single `reminder_next_at` (works for one-off and recurring alike).

ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS recurrence_rule  text,
  ADD COLUMN IF NOT EXISTS reminder_next_at timestamptz;

-- Returns the smallest occurrence STRICTLY AFTER p_after for the given RRULE,
-- anchored at p_from (DTSTART), or NULL once the series has ended. Supports the
-- preset shapes the UI generates: FREQ DAILY/WEEKLY(+BYDAY)/MONTHLY/YEARLY,
-- INTERVAL, and an end of UNTIL=… or COUNT=….
CREATE OR REPLACE FUNCTION public.calendar_next_occurrence(p_rule text, p_from timestamptz, p_after timestamptz)
 RETURNS timestamptz LANGUAGE plpgsql IMMUTABLE
AS $function$
DECLARE
  v_freq     text;
  v_interval int  := 1;
  v_count    int;
  v_until    timestamptz;
  v_until_s  text;
  v_byday    text[];
  v_offsets  int[] := '{}';
  v_tok      text;
  v_weekstart date;
  v_occ      timestamptz;
  v_n        int := 0;
  v_iter     int := 0;
  d          int;
BEGIN
  IF p_rule IS NULL OR p_rule = '' THEN RETURN NULL; END IF;

  v_freq := (regexp_match(p_rule, 'FREQ=([A-Z]+)'))[1];
  v_interval := coalesce((regexp_match(p_rule, 'INTERVAL=([0-9]+)'))[1]::int, 1);
  v_count := (regexp_match(p_rule, 'COUNT=([0-9]+)'))[1]::int;

  v_until_s := (regexp_match(p_rule, 'UNTIL=([0-9TZ]+)'))[1];
  IF v_until_s IS NOT NULL THEN
    v_until_s := replace(replace(v_until_s, 'T', ''), 'Z', '');
    IF length(v_until_s) = 8 THEN v_until_s := v_until_s || '235959'; END IF;
    v_until := to_timestamp(v_until_s, 'YYYYMMDDHH24MISS');  -- UTC session
  END IF;

  -- ── WEEKLY with explicit weekdays ────────────────────────────────────────
  IF v_freq = 'WEEKLY' AND p_rule ~ 'BYDAY=' THEN
    v_byday := string_to_array((regexp_match(p_rule, 'BYDAY=([A-Z,]+)'))[1], ',');
    FOREACH v_tok IN ARRAY v_byday LOOP
      v_offsets := v_offsets || (CASE v_tok
        WHEN 'MO' THEN 0 WHEN 'TU' THEN 1 WHEN 'WE' THEN 2 WHEN 'TH' THEN 3
        WHEN 'FR' THEN 4 WHEN 'SA' THEN 5 WHEN 'SU' THEN 6 END);
    END LOOP;
    v_offsets := (SELECT array_agg(x ORDER BY x) FROM unnest(v_offsets) x);
    v_weekstart := (date_trunc('week', p_from))::date;  -- Monday of DTSTART week

    LOOP
      v_iter := v_iter + 1; EXIT WHEN v_iter > 5000;
      FOREACH d IN ARRAY v_offsets LOOP
        v_occ := p_from + make_interval(days => ((v_weekstart + d) - p_from::date));
        IF v_occ < p_from THEN CONTINUE; END IF;        -- before the series start
        v_n := v_n + 1;
        IF v_count IS NOT NULL AND v_n > v_count THEN RETURN NULL; END IF;
        IF v_until IS NOT NULL AND v_occ > v_until THEN RETURN NULL; END IF;
        IF v_occ > p_after THEN RETURN v_occ; END IF;
      END LOOP;
      v_weekstart := v_weekstart + (v_interval * 7);
    END LOOP;
    RETURN NULL;
  END IF;

  -- ── DAILY / WEEKLY(no BYDAY) / MONTHLY / YEARLY ──────────────────────────
  v_occ := p_from;
  LOOP
    v_iter := v_iter + 1; EXIT WHEN v_iter > 5000;
    v_n := v_n + 1;
    IF v_count IS NOT NULL AND v_n > v_count THEN RETURN NULL; END IF;
    IF v_until IS NOT NULL AND v_occ > v_until THEN RETURN NULL; END IF;
    IF v_occ > p_after THEN RETURN v_occ; END IF;
    v_occ := CASE v_freq
      WHEN 'DAILY'   THEN v_occ + make_interval(days   => v_interval)
      WHEN 'WEEKLY'  THEN v_occ + make_interval(days   => v_interval * 7)
      WHEN 'MONTHLY' THEN v_occ + make_interval(months => v_interval)
      WHEN 'YEARLY'  THEN v_occ + make_interval(years  => v_interval)
      ELSE NULL END;
    IF v_occ IS NULL THEN RETURN NULL; END IF;
  END LOOP;
  RETURN NULL;
END;
$function$;

-- Reminder index now keys off reminder_next_at.
DROP INDEX IF EXISTS calendar_events_reminder_due_idx;
CREATE INDEX IF NOT EXISTS calendar_events_reminder_next_idx
  ON calendar_events (reminder_next_at)
  WHERE reminder_next_at IS NOT NULL AND deleted_at IS NULL;

-- Backfill existing armed one-off reminders into the new column.
UPDATE calendar_events
   SET reminder_next_at = starts_at
 WHERE remind_minutes IS NOT NULL AND deleted_at IS NULL
   AND reminder_sent_at IS NULL AND starts_at > now();
