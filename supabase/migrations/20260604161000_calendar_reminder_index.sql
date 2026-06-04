-- Keep the per-minute reminder dispatcher cheap: a partial index covering only
-- events that still have an un-sent reminder armed. The cron query filters on
-- exactly this predicate and orders by starts_at.
CREATE INDEX IF NOT EXISTS calendar_events_reminder_due_idx
  ON calendar_events (starts_at)
  WHERE remind_minutes IS NOT NULL AND reminder_sent_at IS NULL AND deleted_at IS NULL;
