-- get_my_context()
-- Single round-trip that returns everything the client needs after login:
--   • the authenticated user's profile row
--   • every workstation they belong to, with their role in each
--   • which workstation is currently active
--
-- The role column on workstation_members supports: owner | admin | member | viewer
-- (enforced by a CHECK constraint already in place)
-- This is the foundation for future per-workstation permission checks on the client.

CREATE OR REPLACE FUNCTION public.get_my_context()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_prof profiles%ROWTYPE;
  v_ws   jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_prof FROM profiles WHERE id = v_uid;

  -- All workstations this user is a member of, ordered by when they joined
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id',         w.id,
        'name',       w.name,
        'color',      w.color,
        'owner_id',   w.owner_id,
        'role',       wm.role,
        'joined_at',  wm.joined_at,
        'created_at', w.created_at
      )
      ORDER BY wm.joined_at
    ),
    '[]'::jsonb
  )
  INTO v_ws
  FROM workstations w
  JOIN workstation_members wm ON wm.workstation_id = w.id
  WHERE wm.user_id = v_uid;

  RETURN jsonb_build_object(
    'user', jsonb_build_object(
      'id',        v_prof.id,
      'name',      v_prof.name,
      'email',     v_prof.email,
      'avatar',    v_prof.avatar,
      'joined_at', v_prof.created_at
    ),
    'workstations',          v_ws,
    'active_workstation_id', v_prof.active_workstation_id
  );
END;
$$;
