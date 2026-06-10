-- Allow deleting a user (auth.users) without hitting FK violations.
--
-- Many FKs to auth.users / profiles were created with NO ACTION, so deleting a
-- user failed (e.g. workspace_invites_invited_by_fkey). This sets sensible
-- ON DELETE behaviour:
--   * authorship / actor columns  -> SET NULL  (keep the shared row, blank author)
--   * the user's own personal data -> CASCADE   (time entries)
-- Two NOT NULL actor columns are made nullable so they can be SET NULL.

-- ── auth.users: nullable authorship/actor columns -> SET NULL ───────────────
ALTER TABLE public.calendar_events DROP CONSTRAINT IF EXISTS calendar_events_created_by_fkey,
  ADD CONSTRAINT calendar_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.calendar_events DROP CONSTRAINT IF EXISTS calendar_events_updated_by_fkey,
  ADD CONSTRAINT calendar_events_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.calendar_events DROP CONSTRAINT IF EXISTS calendar_events_deleted_by_fkey,
  ADD CONSTRAINT calendar_events_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.email_templates DROP CONSTRAINT IF EXISTS email_templates_created_by_fkey,
  ADD CONSTRAINT email_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.email_templates DROP CONSTRAINT IF EXISTS email_templates_updated_by_fkey,
  ADD CONSTRAINT email_templates_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.email_templates DROP CONSTRAINT IF EXISTS email_templates_deleted_by_fkey,
  ADD CONSTRAINT email_templates_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.gantt_tasks DROP CONSTRAINT IF EXISTS gantt_tasks_created_by_fkey,
  ADD CONSTRAINT gantt_tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.gantt_tasks DROP CONSTRAINT IF EXISTS gantt_tasks_updated_by_fkey,
  ADD CONSTRAINT gantt_tasks_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.gantt_tasks DROP CONSTRAINT IF EXISTS gantt_tasks_deleted_by_fkey,
  ADD CONSTRAINT gantt_tasks_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.learning DROP CONSTRAINT IF EXISTS learning_created_by_fkey,
  ADD CONSTRAINT learning_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.learning DROP CONSTRAINT IF EXISTS learning_updated_by_fkey,
  ADD CONSTRAINT learning_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.learning DROP CONSTRAINT IF EXISTS learning_deleted_by_fkey,
  ADD CONSTRAINT learning_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.notes DROP CONSTRAINT IF EXISTS notes_created_by_fkey,
  ADD CONSTRAINT notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.notes DROP CONSTRAINT IF EXISTS notes_updated_by_fkey,
  ADD CONSTRAINT notes_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.notes DROP CONSTRAINT IF EXISTS notes_deleted_by_fkey,
  ADD CONSTRAINT notes_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_created_by_fkey,
  ADD CONSTRAINT projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_updated_by_fkey,
  ADD CONSTRAINT projects_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_deleted_by_fkey,
  ADD CONSTRAINT projects_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.task_attachments DROP CONSTRAINT IF EXISTS task_attachments_uploaded_by_fkey,
  ADD CONSTRAINT task_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_created_by_fkey,
  ADD CONSTRAINT tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_updated_by_fkey,
  ADD CONSTRAINT tasks_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_deleted_by_fkey,
  ADD CONSTRAINT tasks_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.vault DROP CONSTRAINT IF EXISTS vault_created_by_fkey,
  ADD CONSTRAINT vault_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.vault DROP CONSTRAINT IF EXISTS vault_updated_by_fkey,
  ADD CONSTRAINT vault_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.vault DROP CONSTRAINT IF EXISTS vault_deleted_by_fkey,
  ADD CONSTRAINT vault_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.workstation_members DROP CONSTRAINT IF EXISTS workstation_members_invited_by_fkey,
  ADD CONSTRAINT workstation_members_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── auth.users: personal data -> CASCADE ────────────────────────────────────
ALTER TABLE public.time_entries DROP CONSTRAINT IF EXISTS time_entries_user_id_fkey,
  ADD CONSTRAINT time_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ── auth.users: NOT NULL actor columns -> make nullable, then SET NULL ───────
ALTER TABLE public.workspace_invites ALTER COLUMN invited_by DROP NOT NULL;
ALTER TABLE public.workspace_invites DROP CONSTRAINT IF EXISTS workspace_invites_invited_by_fkey,
  ADD CONSTRAINT workspace_invites_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.workspace_integrations ALTER COLUMN connected_by DROP NOT NULL;
ALTER TABLE public.workspace_integrations DROP CONSTRAINT IF EXISTS workspace_integrations_connected_by_fkey,
  ADD CONSTRAINT workspace_integrations_connected_by_fkey FOREIGN KEY (connected_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── profiles: authorship columns on the email tables -> SET NULL ────────────
ALTER TABLE public.app_email_templates DROP CONSTRAINT IF EXISTS app_email_templates_updated_by_fkey,
  ADD CONSTRAINT app_email_templates_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.contact_replies DROP CONSTRAINT IF EXISTS contact_replies_sent_by_fkey,
  ADD CONSTRAINT contact_replies_sent_by_fkey FOREIGN KEY (sent_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.contact_reply_templates DROP CONSTRAINT IF EXISTS contact_reply_templates_updated_by_fkey,
  ADD CONSTRAINT contact_reply_templates_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
