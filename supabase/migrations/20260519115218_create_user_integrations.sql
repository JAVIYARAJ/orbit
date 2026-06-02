-- User integrations table: stores OAuth tokens for connected providers
CREATE TABLE user_integrations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider      text NOT NULL CHECK (provider IN ('github', 'gitlab', 'jira', 'slack', 'notion')),
  access_token  text NOT NULL,
  username      text,
  display_name  text,
  avatar_url    text,
  email         text,
  scopes        text[],
  metadata      jsonb DEFAULT '{}',
  connected_at  timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (user_id, provider)
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_user_integrations_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_user_integrations_updated_at
  BEFORE UPDATE ON user_integrations
  FOR EACH ROW EXECUTE FUNCTION update_user_integrations_updated_at();

-- RLS: users can only see/modify their own integrations
ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select" ON user_integrations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "owner_insert" ON user_integrations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "owner_update" ON user_integrations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "owner_delete" ON user_integrations
  FOR DELETE USING (auth.uid() = user_id);
