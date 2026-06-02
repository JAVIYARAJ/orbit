-- ─── 1. Workstations table (no SELECT policy yet — needs workstation_members) ──
CREATE TABLE workstations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  color      text NOT NULL DEFAULT '#0099ff',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER set_workstations_updated_at
  BEFORE UPDATE ON workstations
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE workstations ENABLE ROW LEVEL SECURITY;

-- ─── 2. Workstation Members table ───────────────────────────────────
CREATE TABLE workstation_members (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workstation_id uuid NOT NULL REFERENCES workstations(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES auth.users(id)   ON DELETE CASCADE,
  role           text NOT NULL DEFAULT 'owner'
                   CHECK (role IN ('owner','admin','member','viewer')),
  invited_by     uuid REFERENCES auth.users(id),
  joined_at      timestamptz DEFAULT now(),
  created_at     timestamptz DEFAULT now(),
  UNIQUE(workstation_id, user_id)
);

ALTER TABLE workstation_members ENABLE ROW LEVEL SECURITY;

-- ─── 3. RLS policies (both tables now exist) ────────────────────────

-- workstations
CREATE POLICY "ws_insert" ON workstations FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "ws_select" ON workstations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workstation_members
      WHERE workstation_members.workstation_id = workstations.id
        AND workstation_members.user_id = auth.uid()
    )
  );

CREATE POLICY "ws_update" ON workstations FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "ws_delete" ON workstations FOR DELETE
  USING (owner_id = auth.uid());

-- workstation_members: each user sees only their own rows (non-recursive, safe)
CREATE POLICY "wm_select" ON workstation_members FOR SELECT
  USING (user_id = auth.uid());

-- A user can only insert their own owner row (invite flow uses SECURITY DEFINER fn later)
CREATE POLICY "wm_insert" ON workstation_members FOR INSERT
  WITH CHECK (user_id = auth.uid() AND role = 'owner');

CREATE POLICY "wm_update" ON workstation_members FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "wm_delete" ON workstation_members FOR DELETE
  USING (user_id = auth.uid());

-- ─── 4. Add workstation_id to all data tables ────────────────────────
ALTER TABLE projects        ADD COLUMN workstation_id uuid REFERENCES workstations(id) ON DELETE CASCADE;
ALTER TABLE tasks           ADD COLUMN workstation_id uuid REFERENCES workstations(id) ON DELETE CASCADE;
ALTER TABLE notes           ADD COLUMN workstation_id uuid REFERENCES workstations(id) ON DELETE CASCADE;
ALTER TABLE vault           ADD COLUMN workstation_id uuid REFERENCES workstations(id) ON DELETE CASCADE;
ALTER TABLE learning        ADD COLUMN workstation_id uuid REFERENCES workstations(id) ON DELETE CASCADE;
ALTER TABLE email_templates ADD COLUMN workstation_id uuid REFERENCES workstations(id) ON DELETE CASCADE;
ALTER TABLE timer_sessions  ADD COLUMN workstation_id uuid REFERENCES workstations(id) ON DELETE CASCADE;
ALTER TABLE gantt_tasks     ADD COLUMN workstation_id uuid REFERENCES workstations(id) ON DELETE CASCADE;

-- ─── 5. Active workstation on profiles ──────────────────────────────
ALTER TABLE profiles ADD COLUMN active_workstation_id uuid REFERENCES workstations(id);

-- ─── 6. Update data table RLS: scope to workstation membership ───────
DROP POLICY own_projects        ON projects;
DROP POLICY own_tasks           ON tasks;
DROP POLICY own_notes           ON notes;
DROP POLICY own_vault           ON vault;
DROP POLICY own_learning        ON learning;
DROP POLICY own_email_templates ON email_templates;
DROP POLICY own_timer_sessions  ON timer_sessions;
DROP POLICY own_gantt_tasks     ON gantt_tasks;

CREATE POLICY "projects_ws" ON projects FOR ALL
  USING (
    workstation_id IS NOT NULL AND
    EXISTS (SELECT 1 FROM workstation_members wm
            WHERE wm.workstation_id = projects.workstation_id AND wm.user_id = auth.uid())
  )
  WITH CHECK (
    workstation_id IS NOT NULL AND
    EXISTS (SELECT 1 FROM workstation_members wm
            WHERE wm.workstation_id = projects.workstation_id AND wm.user_id = auth.uid())
  );

CREATE POLICY "tasks_ws" ON tasks FOR ALL
  USING (
    workstation_id IS NOT NULL AND
    EXISTS (SELECT 1 FROM workstation_members wm
            WHERE wm.workstation_id = tasks.workstation_id AND wm.user_id = auth.uid())
  )
  WITH CHECK (
    workstation_id IS NOT NULL AND
    EXISTS (SELECT 1 FROM workstation_members wm
            WHERE wm.workstation_id = tasks.workstation_id AND wm.user_id = auth.uid())
  );

CREATE POLICY "notes_ws" ON notes FOR ALL
  USING (
    workstation_id IS NOT NULL AND
    EXISTS (SELECT 1 FROM workstation_members wm
            WHERE wm.workstation_id = notes.workstation_id AND wm.user_id = auth.uid())
  )
  WITH CHECK (
    workstation_id IS NOT NULL AND
    EXISTS (SELECT 1 FROM workstation_members wm
            WHERE wm.workstation_id = notes.workstation_id AND wm.user_id = auth.uid())
  );

CREATE POLICY "vault_ws" ON vault FOR ALL
  USING (
    workstation_id IS NOT NULL AND
    EXISTS (SELECT 1 FROM workstation_members wm
            WHERE wm.workstation_id = vault.workstation_id AND wm.user_id = auth.uid())
  )
  WITH CHECK (
    workstation_id IS NOT NULL AND
    EXISTS (SELECT 1 FROM workstation_members wm
            WHERE wm.workstation_id = vault.workstation_id AND wm.user_id = auth.uid())
  );

CREATE POLICY "learning_ws" ON learning FOR ALL
  USING (
    workstation_id IS NOT NULL AND
    EXISTS (SELECT 1 FROM workstation_members wm
            WHERE wm.workstation_id = learning.workstation_id AND wm.user_id = auth.uid())
  )
  WITH CHECK (
    workstation_id IS NOT NULL AND
    EXISTS (SELECT 1 FROM workstation_members wm
            WHERE wm.workstation_id = learning.workstation_id AND wm.user_id = auth.uid())
  );

CREATE POLICY "email_templates_ws" ON email_templates FOR ALL
  USING (
    workstation_id IS NOT NULL AND
    EXISTS (SELECT 1 FROM workstation_members wm
            WHERE wm.workstation_id = email_templates.workstation_id AND wm.user_id = auth.uid())
  )
  WITH CHECK (
    workstation_id IS NOT NULL AND
    EXISTS (SELECT 1 FROM workstation_members wm
            WHERE wm.workstation_id = email_templates.workstation_id AND wm.user_id = auth.uid())
  );

CREATE POLICY "timer_sessions_ws" ON timer_sessions FOR ALL
  USING (
    workstation_id IS NOT NULL AND
    EXISTS (SELECT 1 FROM workstation_members wm
            WHERE wm.workstation_id = timer_sessions.workstation_id AND wm.user_id = auth.uid())
  )
  WITH CHECK (
    workstation_id IS NOT NULL AND
    EXISTS (SELECT 1 FROM workstation_members wm
            WHERE wm.workstation_id = timer_sessions.workstation_id AND wm.user_id = auth.uid())
  );

CREATE POLICY "gantt_tasks_ws" ON gantt_tasks FOR ALL
  USING (
    workstation_id IS NOT NULL AND
    EXISTS (SELECT 1 FROM workstation_members wm
            WHERE wm.workstation_id = gantt_tasks.workstation_id AND wm.user_id = auth.uid())
  )
  WITH CHECK (
    workstation_id IS NOT NULL AND
    EXISTS (SELECT 1 FROM workstation_members wm
            WHERE wm.workstation_id = gantt_tasks.workstation_id AND wm.user_id = auth.uid())
  );
