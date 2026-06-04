-- Team / permission RPCs: write activity_log rows (no stamp columns on these tables).
-- Preserves the existing permission checks added by the workspace-permission guards.

CREATE OR REPLACE FUNCTION public.invite_member(p_workstation_id uuid, p_email text, p_role text, p_workspace_name text, p_inviter_name text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_result JSONB; v_is_owner BOOLEAN;
BEGIN
  IF p_role NOT IN ('admin','member','viewer') THEN RAISE EXCEPTION 'invalid_role'; END IF;
  IF NOT has_workspace_permission(p_workstation_id, 'invite_member') THEN RAISE EXCEPTION 'permission_denied'; END IF;
  SELECT EXISTS(SELECT 1 FROM workstation_members
    WHERE workstation_id = p_workstation_id AND user_id = auth.uid() AND role = 'owner') INTO v_is_owner;
  IF p_role = 'admin' AND NOT v_is_owner AND NOT has_workspace_permission(p_workstation_id, 'change_role') THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  INSERT INTO workspace_invites (workstation_id, invited_by, email, role, workspace_name, inviter_name)
  VALUES (p_workstation_id, auth.uid(), p_email, p_role, p_workspace_name, p_inviter_name)
  ON CONFLICT (token) DO NOTHING
  RETURNING jsonb_build_object('id', id, 'token', token, 'email', email, 'role', role,
    'status', status, 'created_at', created_at, 'expires_at', expires_at) INTO v_result;

  IF v_result IS NULL THEN
    UPDATE workspace_invites
    SET expires_at = NOW() + INTERVAL '7 days', role = p_role,
        workspace_name = p_workspace_name, inviter_name = p_inviter_name
    WHERE workstation_id = p_workstation_id AND email = p_email AND status = 'pending'
    RETURNING jsonb_build_object('id', id, 'token', token, 'email', email, 'role', role,
      'status', status, 'created_at', created_at, 'expires_at', expires_at) INTO v_result;
  END IF;

  PERFORM log_activity(p_workstation_id, 'invite', NULL, p_email, 'created', jsonb_build_object('role', p_role));
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_invite(p_invite_id bigint)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_ws uuid; v_email text;
BEGIN
  UPDATE workspace_invites SET status = 'cancelled'
  WHERE id = p_invite_id
    AND workstation_id IN (SELECT workstation_id FROM workstation_members
                           WHERE user_id = auth.uid() AND role IN ('owner','admin'))
  RETURNING workstation_id, email INTO v_ws, v_email;
  IF v_ws IS NOT NULL THEN
    PERFORM log_activity(v_ws, 'invite', NULL, v_email, 'deleted');
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.accept_invite(p_token uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_invite workspace_invites%ROWTYPE; v_email text; v_name text;
BEGIN
  SELECT * INTO v_invite FROM workspace_invites
  WHERE token = p_token AND status = 'pending' AND expires_at > NOW();
  IF NOT FOUND THEN RETURN jsonb_build_object('error','invite_not_found'); END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  IF lower(v_email) != lower(v_invite.email) THEN
    RETURN jsonb_build_object('error','email_mismatch');
  END IF;

  INSERT INTO workstation_members (workstation_id, user_id, role, invited_by)
  VALUES (v_invite.workstation_id, auth.uid(), v_invite.role, v_invite.invited_by)
  ON CONFLICT (workstation_id, user_id) DO NOTHING;

  UPDATE workspace_invites SET status = 'accepted' WHERE id = v_invite.id;

  SELECT COALESCE(name, email) INTO v_name FROM profiles WHERE id = auth.uid();
  PERFORM log_activity(v_invite.workstation_id, 'member', auth.uid(), COALESCE(v_name, v_invite.email),
                       'created', jsonb_build_object('role', v_invite.role, 'via', 'invite'));

  RETURN jsonb_build_object('workstation_id', v_invite.workstation_id, 'role', v_invite.role);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_member_role(p_workstation_id uuid, p_user_id uuid, p_role text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_target_role text; v_name text;
BEGIN
  IF p_role NOT IN ('admin','member','viewer') THEN RAISE EXCEPTION 'invalid_role'; END IF;
  IF NOT has_workspace_permission(p_workstation_id, 'change_role') THEN RAISE EXCEPTION 'permission_denied'; END IF;

  SELECT role INTO v_target_role FROM workstation_members
  WHERE workstation_id = p_workstation_id AND user_id = p_user_id;
  IF v_target_role IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_target_role = 'owner' THEN RAISE EXCEPTION 'permission_denied'; END IF;

  UPDATE workstation_members SET role = p_role
  WHERE workstation_id = p_workstation_id AND user_id = p_user_id;

  SELECT COALESCE(name, email) INTO v_name FROM profiles WHERE id = p_user_id;
  PERFORM log_activity(p_workstation_id, 'member', p_user_id, v_name, 'updated',
                       jsonb_build_object('from_role', v_target_role, 'to_role', p_role));
END;
$function$;

CREATE OR REPLACE FUNCTION public.remove_member(p_workstation_id uuid, p_user_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_caller_role text; v_target_role text; v_name text;
BEGIN
  IF p_user_id = auth.uid() THEN RAISE EXCEPTION 'permission_denied'; END IF;
  SELECT role INTO v_caller_role FROM workstation_members WHERE workstation_id = p_workstation_id AND user_id = auth.uid();
  SELECT role INTO v_target_role FROM workstation_members WHERE workstation_id = p_workstation_id AND user_id = p_user_id;
  IF v_target_role IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT has_workspace_permission(p_workstation_id, 'remove_member') THEN RAISE EXCEPTION 'permission_denied'; END IF;
  IF v_target_role = 'owner' THEN RAISE EXCEPTION 'permission_denied'; END IF;
  IF v_target_role = 'admin' AND v_caller_role <> 'owner' THEN RAISE EXCEPTION 'permission_denied'; END IF;

  SELECT COALESCE(name, email) INTO v_name FROM profiles WHERE id = p_user_id;
  UPDATE tasks SET assignee_id = NULL WHERE workstation_id = p_workstation_id AND assignee_id = p_user_id;
  DELETE FROM workstation_members WHERE workstation_id = p_workstation_id AND user_id = p_user_id;

  PERFORM log_activity(p_workstation_id, 'member', p_user_id, v_name, 'deleted',
                       jsonb_build_object('role', v_target_role));
END;
$function$;

CREATE OR REPLACE FUNCTION public.transfer_ownership(p_workstation_id uuid, p_new_owner_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_caller uuid := auth.uid(); v_target_role text; v_ws_name text; v_new_name text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM workstation_members
    WHERE workstation_id = p_workstation_id AND user_id = v_caller AND role = 'owner')
  THEN RAISE EXCEPTION 'permission_denied'; END IF;
  IF p_new_owner_id = v_caller THEN RAISE EXCEPTION 'already_owner'; END IF;

  SELECT role INTO v_target_role FROM workstation_members
  WHERE workstation_id = p_workstation_id AND user_id = p_new_owner_id;
  IF v_target_role IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;

  UPDATE workstation_members SET role = 'owner' WHERE workstation_id = p_workstation_id AND user_id = p_new_owner_id;
  UPDATE workstation_members SET role = 'admin' WHERE workstation_id = p_workstation_id AND user_id = v_caller;
  UPDATE workstations SET owner_id = p_new_owner_id WHERE id = p_workstation_id;

  SELECT name INTO v_ws_name FROM workstations WHERE id = p_workstation_id;
  SELECT COALESCE(name, email) INTO v_new_name FROM profiles WHERE id = p_new_owner_id;
  PERFORM log_activity(p_workstation_id, 'workspace', p_workstation_id, v_ws_name, 'updated',
                       jsonb_build_object('action', 'ownership_transferred', 'new_owner_id', p_new_owner_id, 'new_owner_name', v_new_name));
END;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_permission(p_workstation_id uuid, p_role text, p_key text, p_allowed boolean)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM workstation_members
    WHERE workstation_id = p_workstation_id AND user_id = auth.uid() AND role = 'owner')
  THEN RAISE EXCEPTION 'permission_denied'; END IF;

  INSERT INTO workspace_role_permissions (workstation_id, role, permission_key, allowed)
  VALUES (p_workstation_id, p_role, p_key, p_allowed)
  ON CONFLICT (workstation_id, role, permission_key) DO UPDATE SET allowed = EXCLUDED.allowed;

  PERFORM log_activity(p_workstation_id, 'permission', NULL, p_role || ':' || p_key, 'updated',
                       jsonb_build_object('role', p_role, 'key', p_key, 'allowed', p_allowed));
END;
$function$;
