-- Store the brevo-webhook token in Vault and verify it via RPC, so the
-- brevo-webhook Edge Function no longer depends on a BREVO_WEBHOOK_SECRET env
-- var that must be kept in sync with the ?token= in the Brevo webhook URL.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'brevo_webhook_secret') THEN
    PERFORM vault.create_secret(
      '2bc8d833a72ee595e709c743f0a8c45970005bea9c045f73',
      'brevo_webhook_secret',
      'Token the Brevo webhook passes (?token=) to the brevo-webhook Edge Function'
    );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.verify_brevo_webhook_secret(p_secret text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
    WHERE name = 'brevo_webhook_secret'
      AND decrypted_secret = p_secret
  );
$$;

REVOKE EXECUTE ON FUNCTION public.verify_brevo_webhook_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_brevo_webhook_secret(text) TO service_role;
