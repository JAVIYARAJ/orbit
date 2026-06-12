-- When a workspace invite is sent to someone who ALREADY has an Orbit account,
-- also drop an in-web notification in their bell (in addition to the email).
-- Brand-new invitees have no profile yet, so they only get the email.
-- The notification still respects the recipient's in-web toggle via the
-- enforce_web_notification_pref trigger on notifications.

CREATE OR REPLACE FUNCTION public.invite_member(
  p_workstation_id uuid,
  p_email text,
  p_role text,
  p_workspace_name text,
  p_inviter_name text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result   JSONB;
  v_is_owner BOOLEAN;
  v_invitee  uuid;
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

  -- In-web notification for an existing account (matched by email, case-insensitive).
  SELECT id INTO v_invitee FROM profiles WHERE lower(email) = lower(p_email) LIMIT 1;
  IF v_invitee IS NOT NULL THEN
    PERFORM notify(
      v_invitee,
      auth.uid(),
      'workspace_invite',
      p_workstation_id,
      'workspace',
      v_result->>'id',
      p_workspace_name,
      'Joining as ' || initcap(p_role) || '. Open the invite email to accept.',
      jsonb_build_object('role', p_role, 'inviter_name', p_inviter_name, 'workspace_name', p_workspace_name)
    );
  END IF;

  RETURN v_result;
END;
$function$;
