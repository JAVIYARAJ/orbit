CREATE OR REPLACE FUNCTION public.reset_vault(p_workstation_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only allow deleting items the user owns in that workstation
  DELETE FROM vault
  WHERE user_id = auth.uid()
    AND workstation_id = p_workstation_id;

  DELETE FROM vault_config
  WHERE user_id = auth.uid()
    AND workstation_id = p_workstation_id;
END;
$function$;
