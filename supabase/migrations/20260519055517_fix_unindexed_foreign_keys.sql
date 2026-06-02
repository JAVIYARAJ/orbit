-- Fix: unindexed_foreign_keys (30 INFO warnings)
-- Creates indexes on all foreign key columns missing coverage.
-- Improves JOIN and lookup performance, especially for RLS policy subqueries.

CREATE INDEX IF NOT EXISTS idx_email_templates_user_id ON public.email_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_workstation_id ON public.email_templates(workstation_id);

CREATE INDEX IF NOT EXISTS idx_gantt_tasks_user_id ON public.gantt_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_gantt_tasks_workstation_id ON public.gantt_tasks(workstation_id);

CREATE INDEX IF NOT EXISTS idx_learning_user_id ON public.learning(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_workstation_id ON public.learning(workstation_id);

CREATE INDEX IF NOT EXISTS idx_notes_user_id ON public.notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_workstation_id ON public.notes(workstation_id);

CREATE INDEX IF NOT EXISTS idx_profiles_active_workstation_id ON public.profiles(active_workstation_id);

CREATE INDEX IF NOT EXISTS idx_project_types_workstation_id ON public.project_types(workstation_id);

CREATE INDEX IF NOT EXISTS idx_projects_project_type_id ON public.projects(project_type_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_workstation_id ON public.projects(workstation_id);

CREATE INDEX IF NOT EXISTS idx_task_note_links_note_id ON public.task_note_links(note_id);

CREATE INDEX IF NOT EXISTS idx_task_status_logs_from_status_id ON public.task_status_logs(from_status_id);
CREATE INDEX IF NOT EXISTS idx_task_status_logs_task_id ON public.task_status_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_status_logs_to_status_id ON public.task_status_logs(to_status_id);

CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON public.tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status_id ON public.tasks(status_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_workstation_id ON public.tasks(workstation_id);

CREATE INDEX IF NOT EXISTS idx_time_entries_project_id ON public.time_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_task_id ON public.time_entries(task_id);

CREATE INDEX IF NOT EXISTS idx_timer_sessions_user_id ON public.timer_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_timer_sessions_workstation_id ON public.timer_sessions(workstation_id);

CREATE INDEX IF NOT EXISTS idx_vault_user_id ON public.vault(user_id);
CREATE INDEX IF NOT EXISTS idx_vault_workstation_id ON public.vault(workstation_id);

CREATE INDEX IF NOT EXISTS idx_workstation_members_invited_by ON public.workstation_members(invited_by);
CREATE INDEX IF NOT EXISTS idx_workstation_members_user_id ON public.workstation_members(user_id);

CREATE INDEX IF NOT EXISTS idx_workstations_owner_id ON public.workstations(owner_id);
