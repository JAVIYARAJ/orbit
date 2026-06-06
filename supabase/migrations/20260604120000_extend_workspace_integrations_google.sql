-- Extend workspace_integrations to support Google Calendar (OAuth offline access).
-- Google requires a long-lived refresh_token + a short-lived access_token that
-- the proxy edge function refreshes on demand using token_expires_at.

ALTER TABLE workspace_integrations
  ADD COLUMN IF NOT EXISTS refresh_token    text,
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz;

-- Allow the new provider value.
ALTER TABLE workspace_integrations DROP CONSTRAINT IF EXISTS workspace_integrations_provider_check;
ALTER TABLE workspace_integrations
  ADD CONSTRAINT workspace_integrations_provider_check
  CHECK (provider = ANY (ARRAY['github','vercel','google_calendar']));
