-- Fix: authenticated_security_definer_function_executable
-- Convert 51 application functions from SECURITY DEFINER to SECURITY INVOKER.
-- All tables already have RLS policies that use auth.uid(), so this is safe.
-- Functions run as the calling user — RLS enforces access, same as before.

ALTER FUNCTION public.check_workstation_empty(uuid) SECURITY INVOKER;
ALTER FUNCTION public.complete_time_entry(uuid, integer, text) SECURITY INVOKER;
ALTER FUNCTION public.create_email_template(uuid, jsonb) SECURITY INVOKER;
ALTER FUNCTION public.create_learning_item(uuid, jsonb) SECURITY INVOKER;
ALTER FUNCTION public.create_my_workstation(text, text) SECURITY INVOKER;
ALTER FUNCTION public.create_note(uuid, jsonb) SECURITY INVOKER;
ALTER FUNCTION public.create_project(uuid, jsonb) SECURITY INVOKER;
ALTER FUNCTION public.create_project_type(uuid, jsonb) SECURITY INVOKER;
ALTER FUNCTION public.create_tag(uuid, jsonb) SECURITY INVOKER;
ALTER FUNCTION public.create_task(uuid, jsonb) SECURITY INVOKER;
ALTER FUNCTION public.create_task_status(uuid, jsonb) SECURITY INVOKER;
ALTER FUNCTION public.create_vault_item(uuid, jsonb) SECURITY INVOKER;
ALTER FUNCTION public.delete_email_template(text) SECURITY INVOKER;
ALTER FUNCTION public.delete_note(uuid) SECURITY INVOKER;
ALTER FUNCTION public.delete_project(text) SECURITY INVOKER;
ALTER FUNCTION public.delete_project_type(uuid) SECURITY INVOKER;
ALTER FUNCTION public.delete_tag(uuid) SECURITY INVOKER;
ALTER FUNCTION public.delete_task(text) SECURITY INVOKER;
ALTER FUNCTION public.delete_task_status(uuid) SECURITY INVOKER;
ALTER FUNCTION public.delete_vault_item(uuid) SECURITY INVOKER;
ALTER FUNCTION public.discard_time_entry(uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_active_time_entry(uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_deleted_notes(uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_my_context() SECURITY INVOKER;
ALTER FUNCTION public.get_my_workstations() SECURITY INVOKER;
ALTER FUNCTION public.get_task_note_links(uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_task_status_logs(uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_time_entries(uuid, integer) SECURITY INVOKER;
ALTER FUNCTION public.link_note_to_task(uuid, uuid) SECURITY INVOKER;
ALTER FUNCTION public.load_workstation_data(uuid) SECURITY INVOKER;
ALTER FUNCTION public.log_manual_time(uuid, uuid, uuid, integer, text) SECURITY INVOKER;
ALTER FUNCTION public.pause_time_entry(uuid, integer) SECURITY INVOKER;
ALTER FUNCTION public.purge_note(uuid) SECURITY INVOKER;
ALTER FUNCTION public.reorder_project_types(uuid, jsonb) SECURITY INVOKER;
ALTER FUNCTION public.reorder_task_statuses(uuid, jsonb) SECURITY INVOKER;
ALTER FUNCTION public.restore_note(uuid) SECURITY INVOKER;
ALTER FUNCTION public.resume_time_entry(uuid) SECURITY INVOKER;
ALTER FUNCTION public.seed_workstation_data(uuid, jsonb) SECURITY INVOKER;
ALTER FUNCTION public.start_time_entry(uuid, uuid, uuid) SECURITY INVOKER;
ALTER FUNCTION public.switch_active_workstation(uuid) SECURITY INVOKER;
ALTER FUNCTION public.te_json(uuid) SECURITY INVOKER;
ALTER FUNCTION public.unlink_note_from_task(uuid, uuid) SECURITY INVOKER;
ALTER FUNCTION public.update_email_template(text, jsonb) SECURITY INVOKER;
ALTER FUNCTION public.update_my_avatar(text) SECURITY INVOKER;
ALTER FUNCTION public.update_note(uuid, jsonb) SECURITY INVOKER;
ALTER FUNCTION public.update_project(text, jsonb) SECURITY INVOKER;
ALTER FUNCTION public.update_project_type(uuid, jsonb) SECURITY INVOKER;
ALTER FUNCTION public.update_tag(uuid, jsonb) SECURITY INVOKER;
ALTER FUNCTION public.update_task(text, jsonb) SECURITY INVOKER;
ALTER FUNCTION public.update_task_status(uuid, jsonb) SECURITY INVOKER;
ALTER FUNCTION public.update_vault_item(uuid, jsonb) SECURITY INVOKER;

-- Trigger functions must stay SECURITY DEFINER (auth.uid() is NULL at trigger time,
-- and seed_default_statuses runs before the user is a workstation member).
-- Revoke direct execution from authenticated so users cannot call them via REST API.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_default_statuses() FROM authenticated;
