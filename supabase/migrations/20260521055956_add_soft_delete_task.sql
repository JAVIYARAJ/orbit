CREATE OR REPLACE FUNCTION public.soft_delete_task(p_task_id text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE tasks
  SET deleted_at = now()
  WHERE task_id = p_task_id
    AND deleted_at IS NULL
    AND workstation_id IN (
      SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid()
    );
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
END;
$function$;
