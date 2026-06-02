-- Fix: function_search_path_mutable
-- Adds SET search_path = public to all functions missing it, preventing search_path injection attacks.

ALTER FUNCTION public.complete_time_entry(uuid, integer, text) SET search_path = public;
ALTER FUNCTION public.create_project_type(uuid, jsonb) SET search_path = public;
ALTER FUNCTION public.create_task(uuid, jsonb) SET search_path = public;
ALTER FUNCTION public.create_task_status(uuid, jsonb) SET search_path = public;
ALTER FUNCTION public.delete_project_type(uuid) SET search_path = public;
ALTER FUNCTION public.delete_task_status(uuid) SET search_path = public;
ALTER FUNCTION public.discard_time_entry(uuid) SET search_path = public;
ALTER FUNCTION public.get_active_time_entry(uuid) SET search_path = public;
ALTER FUNCTION public.get_time_entries(uuid, integer) SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.handle_updated_at() SET search_path = public;
ALTER FUNCTION public.log_manual_time(uuid, uuid, uuid, integer, text) SET search_path = public;
ALTER FUNCTION public.pause_time_entry(uuid, integer) SET search_path = public;
ALTER FUNCTION public.reorder_project_types(uuid, jsonb) SET search_path = public;
ALTER FUNCTION public.reorder_task_statuses(uuid, jsonb) SET search_path = public;
ALTER FUNCTION public.resume_time_entry(uuid) SET search_path = public;
ALTER FUNCTION public.seed_default_statuses() SET search_path = public;
ALTER FUNCTION public.start_time_entry(uuid, uuid, uuid) SET search_path = public;
ALTER FUNCTION public.te_json(uuid) SET search_path = public;
ALTER FUNCTION public.update_project_type(uuid, jsonb) SET search_path = public;
ALTER FUNCTION public.update_task(text, jsonb) SET search_path = public;
ALTER FUNCTION public.update_task_status(uuid, jsonb) SET search_path = public;
