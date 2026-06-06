ALTER TABLE user_integrations
  DROP CONSTRAINT user_integrations_provider_check;

ALTER TABLE user_integrations
  ADD CONSTRAINT user_integrations_provider_check
  CHECK (provider = ANY (ARRAY['github', 'gitlab', 'jira', 'slack', 'notion', 'vercel']));
