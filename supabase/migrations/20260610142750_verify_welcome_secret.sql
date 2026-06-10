-- Verify the welcome-email shared secret against the Vault value, so the
-- welcome-email Edge Function no longer needs a duplicate WELCOME_HOOK_SECRET
-- env var (single source of truth = the Vault secret the trigger also reads).

CREATE OR REPLACE FUNCTION public.verify_welcome_secret(p_secret text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
    WHERE name = 'welcome_hook_secret'
      AND decrypted_secret = p_secret
  );
$$;

REVOKE EXECUTE ON FUNCTION public.verify_welcome_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_welcome_secret(text) TO service_role;
