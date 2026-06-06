-- 1. Add is_encrypted flag to vault table
ALTER TABLE vault ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Update create_vault_item to store is_encrypted
CREATE OR REPLACE FUNCTION public.create_vault_item(p_workstation_id uuid, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v_row vault%rowtype;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM workstation_members
    WHERE workstation_id = p_workstation_id AND user_id = auth.uid())
  THEN RAISE EXCEPTION 'access_denied'; END IF;

  INSERT INTO vault(user_id, workstation_id, cat, name, value, is_encrypted)
  VALUES (
    auth.uid(), p_workstation_id,
    p_data->>'cat', p_data->>'name', p_data->>'value',
    COALESCE((p_data->>'is_encrypted')::boolean, FALSE)
  )
  RETURNING * INTO v_row;
  RETURN row_to_json(v_row)::jsonb;
END;
$function$;

-- 3. Update update_vault_item to store is_encrypted
CREATE OR REPLACE FUNCTION public.update_vault_item(p_item_id uuid, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v_row vault%rowtype;
BEGIN
  UPDATE vault SET
    cat          = COALESCE(p_data->>'cat', cat),
    name         = p_data->>'name',
    value        = p_data->>'value',
    is_encrypted = COALESCE((p_data->>'is_encrypted')::boolean, is_encrypted),
    updated_at   = current_date
  WHERE id = p_item_id
    AND workstation_id IN (SELECT workstation_id FROM workstation_members WHERE user_id = auth.uid())
  RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  RETURN row_to_json(v_row)::jsonb;
END;
$function$;

-- 4. Create vault_config table (stores per-workstation salt + verifier for master password)
CREATE TABLE IF NOT EXISTS vault_config (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workstation_id UUID NOT NULL,
  salt           TEXT NOT NULL,
  verifier       TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, workstation_id)
);

ALTER TABLE vault_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY vault_config_owner ON vault_config
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. RPC: get vault config for current user + workstation
CREATE OR REPLACE FUNCTION public.get_vault_config(p_workstation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v_row vault_config%rowtype;
BEGIN
  SELECT * INTO v_row
  FROM vault_config
  WHERE user_id = auth.uid() AND workstation_id = p_workstation_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN row_to_json(v_row)::jsonb;
END;
$function$;

-- 6. RPC: upsert vault config
CREATE OR REPLACE FUNCTION public.upsert_vault_config(p_workstation_id uuid, p_salt text, p_verifier text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v_row vault_config%rowtype;
BEGIN
  INSERT INTO vault_config(user_id, workstation_id, salt, verifier)
  VALUES (auth.uid(), p_workstation_id, p_salt, p_verifier)
  ON CONFLICT (user_id, workstation_id) DO UPDATE
    SET salt       = EXCLUDED.salt,
        verifier   = EXCLUDED.verifier,
        updated_at = NOW()
  RETURNING * INTO v_row;
  RETURN row_to_json(v_row)::jsonb;
END;
$function$;
