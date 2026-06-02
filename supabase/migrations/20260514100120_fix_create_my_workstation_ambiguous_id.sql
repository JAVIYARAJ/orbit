CREATE OR REPLACE FUNCTION create_my_workstation(p_name text, p_color text DEFAULT '#0099ff')
RETURNS TABLE(
  id         uuid,
  name       text,
  color      text,
  owner_id   uuid,
  role       text,
  created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ws_id uuid;
BEGIN
  INSERT INTO workstations(owner_id, name, color)
  VALUES (auth.uid(), trim(p_name), p_color)
  RETURNING workstations.id INTO v_ws_id;

  INSERT INTO workstation_members(workstation_id, user_id, role)
  VALUES (v_ws_id, auth.uid(), 'owner');

  -- Qualify profiles.id explicitly to avoid ambiguity with RETURNS TABLE id column
  UPDATE profiles
  SET    active_workstation_id = v_ws_id
  WHERE  profiles.id = auth.uid();

  RETURN QUERY
    SELECT w.id, w.name, w.color, w.owner_id, wm.role, w.created_at
    FROM   workstations w
    JOIN   workstation_members wm ON wm.workstation_id = w.id
    WHERE  w.id = v_ws_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_my_workstation(text, text) TO authenticated;
