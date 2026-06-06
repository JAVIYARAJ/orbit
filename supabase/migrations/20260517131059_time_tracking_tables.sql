-- ╔══════════════════════════════════════════════════════════════╗
-- ║  TIME TRACKING — Tables & RLS                                ║
-- ╚══════════════════════════════════════════════════════════════╝

-- One row per work session (start → pause/resume → complete/discard)
CREATE TABLE public.time_entries (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workstation_id   uuid        NOT NULL REFERENCES public.workstations(id) ON DELETE CASCADE,
  user_id          uuid        NOT NULL REFERENCES auth.users(id),
  project_id       uuid        NOT NULL REFERENCES public.projects(id)  ON DELETE CASCADE,
  task_id          uuid                 REFERENCES public.tasks(id)     ON DELETE SET NULL,
  status           text        NOT NULL DEFAULT 'running'
                               CHECK (status IN ('running','paused','completed','discarded')),
  total_seconds    integer     NOT NULL DEFAULT 0,
  notes            text        NOT NULL DEFAULT '',
  started_at       timestamptz NOT NULL DEFAULT now(),
  ended_at         timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Granular event log — every state change with its elapsed snapshot
CREATE TABLE public.time_entry_events (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id        uuid        NOT NULL REFERENCES public.time_entries(id) ON DELETE CASCADE,
  event           text        NOT NULL
                              CHECK (event IN ('start','pause','resume','complete','discard')),
  happened_at     timestamptz NOT NULL DEFAULT now(),
  elapsed_seconds integer     NOT NULL DEFAULT 0
);

-- Indexes
CREATE INDEX time_entries_ws_date_idx  ON public.time_entries  (workstation_id, created_at DESC);
CREATE INDEX time_entries_user_st_idx  ON public.time_entries  (user_id, status);
CREATE INDEX te_events_entry_time_idx  ON public.time_entry_events (entry_id, happened_at);

-- Row-level security
ALTER TABLE public.time_entries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entry_events  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "te_own"  ON public.time_entries
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "tee_own" ON public.time_entry_events
  FOR ALL USING (
    entry_id IN (
      SELECT id FROM public.time_entries WHERE user_id = auth.uid()
    )
  );
