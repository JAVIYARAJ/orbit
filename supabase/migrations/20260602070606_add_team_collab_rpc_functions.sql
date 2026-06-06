-- List members of a workstation with profile info
CREATE OR REPLACE FUNCTION list_workspace_members(p_workstation_id UUID)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'user_id',    wm.user_id,
      'role',       wm.role,
      'joined_at',  wm.joined_at,
      'name',       p.name,
      'email',      p.email,
      'avatar',     p.avatar,
      'avatar_url', p.avatar_url
    ) ORDER BY wm.joined_at
  ), '[]'::jsonb)
  FROM workstation_members wm
  JOIN profiles p ON p.id = wm.user_id
  WHERE wm.workstation_id = p_workstation_id
    AND wm.workstation_id IN (
      SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid()
    );
$$;

-- Create a pending invite
CREATE OR REPLACE FUNCTION invite_member(
  p_workstation_id UUID,
  p_email          TEXT,
  p_role           TEXT,
  p_workspace_name TEXT,
  p_inviter_name   TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Caller must be owner or admin
  IF NOT EXISTS (
    SELECT 1 FROM workstation_members
    WHERE workstation_id = p_workstation_id
      AND user_id = auth.uid()
      AND role IN ('owner','admin')
  ) THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  INSERT INTO workspace_invites
    (workstation_id, invited_by, email, role, workspace_name, inviter_name)
  VALUES
    (p_workstation_id, auth.uid(), p_email, p_role, p_workspace_name, p_inviter_name)
  ON CONFLICT (token) DO NOTHING
  RETURNING jsonb_build_object(
    'id',         id,
    'token',      token,
    'email',      email,
    'role',       role,
    'status',     status,
    'created_at', created_at
  ) INTO v_result;

  -- If the same pending invite already exists for this email+workspace, refresh it
  IF v_result IS NULL THEN
    UPDATE workspace_invites
    SET expires_at = NOW() + INTERVAL '7 days',
        role = p_role,
        workspace_name = p_workspace_name,
        inviter_name = p_inviter_name
    WHERE workstation_id = p_workstation_id
      AND email = p_email
      AND status = 'pending'
    RETURNING jsonb_build_object(
      'id',         id,
      'token',      token,
      'email',      email,
      'role',       role,
      'status',     status,
      'created_at', created_at
    ) INTO v_result;
  END IF;

  RETURN v_result;
END;
$$;

-- Accept an invite (called by the invitee after login)
CREATE OR REPLACE FUNCTION accept_invite(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite workspace_invites%ROWTYPE;
  v_email  TEXT;
BEGIN
  SELECT * INTO v_invite
  FROM workspace_invites
  WHERE token = p_token AND status = 'pending' AND expires_at > NOW();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error','invite_not_found');
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  IF lower(v_email) != lower(v_invite.email) THEN
    RETURN jsonb_build_object('error','email_mismatch');
  END IF;

  INSERT INTO workstation_members (workstation_id, user_id, role, invited_by)
  VALUES (v_invite.workstation_id, auth.uid(), v_invite.role, v_invite.invited_by)
  ON CONFLICT (workstation_id, user_id) DO NOTHING;

  UPDATE workspace_invites SET status = 'accepted' WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'workstation_id', v_invite.workstation_id,
    'role',           v_invite.role
  );
END;
$$;

-- Cancel a pending invite
CREATE OR REPLACE FUNCTION cancel_invite(p_invite_id BIGINT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE workspace_invites
  SET status = 'cancelled'
  WHERE id = p_invite_id
    AND workstation_id IN (
      SELECT workstation_id FROM workstation_members
      WHERE user_id = auth.uid() AND role IN ('owner','admin')
    );
$$;

-- Get pending invites for a workstation
CREATE OR REPLACE FUNCTION get_pending_invites(p_workstation_id UUID)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',         id,
      'email',      email,
      'role',       role,
      'token',      token,
      'created_at', created_at,
      'expires_at', expires_at
    ) ORDER BY created_at DESC
  ), '[]'::jsonb)
  FROM workspace_invites
  WHERE workstation_id = p_workstation_id
    AND status = 'pending'
    AND workstation_id IN (
      SELECT workstation_id FROM workstation_members
      WHERE user_id = auth.uid() AND role IN ('owner','admin')
    );
$$;

-- Get a single invite by token (for the accept-invite page)
CREATE OR REPLACE FUNCTION get_invite_by_token(p_token UUID)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(i)::JSONB
  FROM (
    SELECT id, email, role, workspace_name, inviter_name, status, expires_at, workstation_id
    FROM workspace_invites
    WHERE token = p_token
  ) i;
$$;

-- Update a member's role (owner only)
CREATE OR REPLACE FUNCTION update_member_role(
  p_workstation_id UUID,
  p_user_id        UUID,
  p_role           TEXT
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE workstation_members
  SET role = p_role
  WHERE workstation_id = p_workstation_id
    AND user_id = p_user_id
    AND role != 'owner'
    AND p_workstation_id IN (
      SELECT workstation_id FROM workstation_members
      WHERE user_id = auth.uid() AND role = 'owner'
    );
$$;

-- Remove a member (owner or admin)
CREATE OR REPLACE FUNCTION remove_member(p_workstation_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM workstation_members
  WHERE workstation_id = p_workstation_id
    AND user_id = p_user_id
    AND role != 'owner'
    AND p_workstation_id IN (
      SELECT workstation_id FROM workstation_members
      WHERE user_id = auth.uid() AND role IN ('owner','admin')
    );
$$;

-- Get permission overrides for a workstation (flat key: "admin:invite_member" → bool)
CREATE OR REPLACE FUNCTION get_workspace_permissions(p_workstation_id UUID)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_object_agg(role || ':' || permission_key, allowed),
    '{}'::jsonb
  )
  FROM workspace_role_permissions
  WHERE workstation_id = p_workstation_id
    AND p_workstation_id IN (
      SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid()
    );
$$;

-- Upsert a single permission override (owner only)
CREATE OR REPLACE FUNCTION upsert_permission(
  p_workstation_id UUID,
  p_role           TEXT,
  p_key            TEXT,
  p_allowed        BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM workstation_members
    WHERE workstation_id = p_workstation_id
      AND user_id = auth.uid()
      AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  INSERT INTO workspace_role_permissions (workstation_id, role, permission_key, allowed)
  VALUES (p_workstation_id, p_role, p_key, p_allowed)
  ON CONFLICT (workstation_id, role, permission_key)
    DO UPDATE SET allowed = EXCLUDED.allowed;
END;
$$;
