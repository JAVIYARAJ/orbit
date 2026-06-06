-- Add is_encrypted flag to track which tokens are AES-256-GCM encrypted
ALTER TABLE user_integrations
  ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN NOT NULL DEFAULT FALSE;

-- Fix owner_insert policy: was missing WITH CHECK, allowing inserts with any user_id
DROP POLICY IF EXISTS owner_insert ON user_integrations;
CREATE POLICY owner_insert ON user_integrations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
