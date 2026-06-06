-- Fix 1: auth_rls_initplan (28 warnings)
-- Wrap auth.uid() in (SELECT auth.uid()) so PostgreSQL evaluates it once per query
-- instead of once per row, significantly improving RLS performance.
--
-- Fix 2: multiple_permissive_policies (5 warnings)
-- project_types had an ALL policy + a SELECT policy, creating two permissive SELECT paths.
-- Split into explicit per-command policies.

-- profiles
DROP POLICY "own_profiles" ON public.profiles;
CREATE POLICY "own_profiles" ON public.profiles FOR ALL
  USING ((SELECT auth.uid()) = id);

-- task_status_logs
DROP POLICY "workstation members can manage task status logs" ON public.task_status_logs;
CREATE POLICY "workstation members can manage task status logs" ON public.task_status_logs FOR ALL
  USING (EXISTS (
    SELECT 1 FROM tasks t
    JOIN workstation_members wm ON wm.workstation_id = t.workstation_id
    WHERE t.id = task_status_logs.task_id AND wm.user_id = (SELECT auth.uid())
  ));

-- workstations
DROP POLICY "ws_insert" ON public.workstations;
DROP POLICY "ws_select" ON public.workstations;
DROP POLICY "ws_update" ON public.workstations;
DROP POLICY "ws_delete" ON public.workstations;
CREATE POLICY "ws_insert" ON public.workstations FOR INSERT WITH CHECK (true);
CREATE POLICY "ws_select" ON public.workstations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM workstation_members
    WHERE workstation_members.workstation_id = workstations.id
      AND workstation_members.user_id = (SELECT auth.uid())
  ));
CREATE POLICY "ws_update" ON public.workstations FOR UPDATE
  USING (owner_id = (SELECT auth.uid()));
CREATE POLICY "ws_delete" ON public.workstations FOR DELETE
  USING (owner_id = (SELECT auth.uid()));

-- workstation_members
DROP POLICY "wm_insert" ON public.workstation_members;
DROP POLICY "wm_select" ON public.workstation_members;
DROP POLICY "wm_update" ON public.workstation_members;
DROP POLICY "wm_delete" ON public.workstation_members;
CREATE POLICY "wm_insert" ON public.workstation_members FOR INSERT WITH CHECK (true);
CREATE POLICY "wm_select" ON public.workstation_members FOR SELECT
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "wm_update" ON public.workstation_members FOR UPDATE
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "wm_delete" ON public.workstation_members FOR DELETE
  USING (user_id = (SELECT auth.uid()));

-- projects
DROP POLICY "projects_ws" ON public.projects;
CREATE POLICY "projects_ws" ON public.projects FOR ALL
  USING (workstation_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM workstation_members wm
    WHERE wm.workstation_id = projects.workstation_id AND wm.user_id = (SELECT auth.uid())
  ));

-- tasks
DROP POLICY "tasks_ws" ON public.tasks;
CREATE POLICY "tasks_ws" ON public.tasks FOR ALL
  USING (workstation_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM workstation_members wm
    WHERE wm.workstation_id = tasks.workstation_id AND wm.user_id = (SELECT auth.uid())
  ));

-- notes
DROP POLICY "notes_ws" ON public.notes;
CREATE POLICY "notes_ws" ON public.notes FOR ALL
  USING (workstation_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM workstation_members wm
    WHERE wm.workstation_id = notes.workstation_id AND wm.user_id = (SELECT auth.uid())
  ));

-- vault
DROP POLICY "vault_ws" ON public.vault;
CREATE POLICY "vault_ws" ON public.vault FOR ALL
  USING (workstation_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM workstation_members wm
    WHERE wm.workstation_id = vault.workstation_id AND wm.user_id = (SELECT auth.uid())
  ));

-- learning
DROP POLICY "learning_ws" ON public.learning;
CREATE POLICY "learning_ws" ON public.learning FOR ALL
  USING (workstation_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM workstation_members wm
    WHERE wm.workstation_id = learning.workstation_id AND wm.user_id = (SELECT auth.uid())
  ));

-- email_templates
DROP POLICY "email_templates_ws" ON public.email_templates;
CREATE POLICY "email_templates_ws" ON public.email_templates FOR ALL
  USING (workstation_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM workstation_members wm
    WHERE wm.workstation_id = email_templates.workstation_id AND wm.user_id = (SELECT auth.uid())
  ));

-- timer_sessions
DROP POLICY "timer_sessions_ws" ON public.timer_sessions;
CREATE POLICY "timer_sessions_ws" ON public.timer_sessions FOR ALL
  USING (workstation_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM workstation_members wm
    WHERE wm.workstation_id = timer_sessions.workstation_id AND wm.user_id = (SELECT auth.uid())
  ));

-- gantt_tasks
DROP POLICY "gantt_tasks_ws" ON public.gantt_tasks;
CREATE POLICY "gantt_tasks_ws" ON public.gantt_tasks FOR ALL
  USING (workstation_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM workstation_members wm
    WHERE wm.workstation_id = gantt_tasks.workstation_id AND wm.user_id = (SELECT auth.uid())
  ));

-- task_statuses
DROP POLICY "ts_insert" ON public.task_statuses;
DROP POLICY "ts_select" ON public.task_statuses;
DROP POLICY "ts_update" ON public.task_statuses;
DROP POLICY "ts_delete" ON public.task_statuses;
CREATE POLICY "ts_insert" ON public.task_statuses FOR INSERT WITH CHECK (true);
CREATE POLICY "ts_select" ON public.task_statuses FOR SELECT
  USING (workstation_id IN (
    SELECT workstation_id FROM workstation_members WHERE user_id = (SELECT auth.uid())
  ));
CREATE POLICY "ts_update" ON public.task_statuses FOR UPDATE
  USING (workstation_id IN (
    SELECT workstation_id FROM workstation_members
    WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin')
  ));
CREATE POLICY "ts_delete" ON public.task_statuses FOR DELETE
  USING (workstation_id IN (
    SELECT workstation_id FROM workstation_members
    WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin')
  ));

-- project_types: fix both initplan AND multiple_permissive_policies
-- Replace ALL + SELECT combo with explicit per-command policies
DROP POLICY "members can read project_types" ON public.project_types;
DROP POLICY "owners/admins can write project_types" ON public.project_types;
CREATE POLICY "project_types_select" ON public.project_types FOR SELECT
  USING (workstation_id IN (
    SELECT workstation_id FROM workstation_members WHERE user_id = (SELECT auth.uid())
  ));
CREATE POLICY "project_types_insert" ON public.project_types FOR INSERT
  WITH CHECK (workstation_id IN (
    SELECT workstation_id FROM workstation_members
    WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin')
  ));
CREATE POLICY "project_types_update" ON public.project_types FOR UPDATE
  USING (workstation_id IN (
    SELECT workstation_id FROM workstation_members
    WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin')
  ));
CREATE POLICY "project_types_delete" ON public.project_types FOR DELETE
  USING (workstation_id IN (
    SELECT workstation_id FROM workstation_members
    WHERE user_id = (SELECT auth.uid()) AND role IN ('owner', 'admin')
  ));

-- tags
DROP POLICY "tags_member_access" ON public.tags;
CREATE POLICY "tags_member_access" ON public.tags FOR ALL
  USING (workstation_id IN (
    SELECT workstation_id FROM workstation_members WHERE user_id = (SELECT auth.uid())
  ));

-- task_note_links
DROP POLICY "Users can manage task note links" ON public.task_note_links;
CREATE POLICY "Users can manage task note links" ON public.task_note_links FOR ALL
  USING (EXISTS (
    SELECT 1 FROM tasks t
    JOIN workstation_members wm ON wm.workstation_id = t.workstation_id
    WHERE t.id = task_note_links.task_id AND wm.user_id = (SELECT auth.uid())
  ));

-- time_entries
DROP POLICY "te_own" ON public.time_entries;
CREATE POLICY "te_own" ON public.time_entries FOR ALL
  USING (user_id = (SELECT auth.uid()));

-- time_entry_events
DROP POLICY "tee_own" ON public.time_entry_events;
CREATE POLICY "tee_own" ON public.time_entry_events FOR ALL
  USING (entry_id IN (
    SELECT id FROM time_entries WHERE user_id = (SELECT auth.uid())
  ));
