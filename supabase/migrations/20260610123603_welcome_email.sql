-- Welcome email on signup.
-- When handle_new_user() inserts a row into public.profiles, an AFTER INSERT
-- trigger uses pg_net to call the `welcome-email` Edge Function, which renders
-- the admin-editable template and sends it via Brevo. Fully DB-driven.

-- 1. pg_net for outbound HTTP from Postgres (vault already installed).
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Idempotency stamp: set once the welcome email has been sent.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS welcome_sent_at timestamptz;

-- 3. Admin-editable app email templates (keyed singletons, e.g. 'welcome').
CREATE TABLE IF NOT EXISTS public.app_email_templates (
  key        text PRIMARY KEY,
  subject    text NOT NULL DEFAULT '',
  body       text NOT NULL DEFAULT '',
  enabled    boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id)
);
ALTER TABLE public.app_email_templates ENABLE ROW LEVEL SECURITY;
-- No policies: only the service-role admin Edge Function reads/writes.

INSERT INTO public.app_email_templates (key, subject, body, enabled) VALUES
  ('welcome', 'Welcome to Orbit, {name}! 🚀',
   'Welcome aboard — we''re thrilled to have you on Orbit!

Orbit is your single workspace for projects, tasks, notes and time tracking. Jump in and create your first project to get started.

If you ever need a hand, just reply to this email — we''re happy to help.',
   true)
ON CONFLICT (key) DO NOTHING;

-- 4. Shared secret so only this trigger can invoke the Edge Function.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'welcome_hook_secret') THEN
    PERFORM vault.create_secret(
      '8b2357218f5c65e7ea1a4b4abd08cb040061fd5e43c034b90fffebeebe959038',
      'welcome_hook_secret',
      'Shared secret the profiles welcome trigger passes to the welcome-email Edge Function'
    );
  END IF;
END $$;

-- 5. Trigger function: fire-and-forget POST to the Edge Function.
--    Wrapped so a delivery problem never blocks signup.
CREATE OR REPLACE FUNCTION public.handle_new_user_welcome()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_secret text;
BEGIN
  IF NEW.email IS NULL OR NEW.email = '' THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'welcome_hook_secret'
  LIMIT 1;

  IF v_secret IS NULL THEN
    RETURN NEW;  -- not configured yet; skip quietly
  END IF;

  PERFORM net.http_post(
    url     := 'https://sbogupxrurpsybzivrpk.supabase.co/functions/v1/welcome-email',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-welcome-secret', v_secret
               ),
    body    := jsonb_build_object(
                 'user_id', NEW.id,
                 'email',   NEW.email,
                 'name',    NEW.name
               )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never let an email hiccup break account creation.
  RETURN NEW;
END;
$$;

-- 6. Attach to profiles inserts.
DROP TRIGGER IF EXISTS on_profile_created_welcome ON public.profiles;
CREATE TRIGGER on_profile_created_welcome
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_welcome();
