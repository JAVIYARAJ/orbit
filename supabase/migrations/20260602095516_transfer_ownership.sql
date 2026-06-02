CREATE OR REPLACE FUNCTION public.transfer_ownership(p_workstation_id uuid, p_new_owner_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller       uuid := auth.uid();
  v_target_role  text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM workstation_members
    WHERE workstation_id = p_workstation_id AND user_id = v_caller AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  IF p_new_owner_id = v_caller THEN
    RAISE EXCEPTION 'already_owner';
  END IF;

  SELECT role INTO v_target_role
  FROM workstation_members
  WHERE workstation_id = p_workstation_id AND user_id = p_new_owner_id;
  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  UPDATE workstation_members SET role = 'owner'
  WHERE workstation_id = p_workstation_id AND user_id = p_new_owner_id;

  UPDATE workstation_members SET role = 'admin'
  WHERE workstation_id = p_workstation_id AND user_id = v_caller;

  UPDATE workstations SET owner_id = p_new_owner_id
  WHERE id = p_workstation_id;
END;
$function$;
