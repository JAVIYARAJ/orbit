-- User-level notification preferences that govern the whole platform.
--   email_notifications  → gates activity/broadcast emails
--   web_notifications    → gates ALL in-web (in-app) notifications
-- Both default to TRUE so existing and new users keep receiving everything
-- until they opt out.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_notifications boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS web_notifications   boolean NOT NULL DEFAULT true;

-- ── Central enforcement for in-web notifications ────────────────────
-- A BEFORE INSERT trigger is the single chokepoint that covers every
-- notification source (notify(), notify_many(), broadcast_notification(),
-- and the calendar reminder/due cron jobs). If the recipient has disabled
-- in-web notifications the row is silently skipped.
CREATE OR REPLACE FUNCTION public.enforce_web_notification_pref()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = NEW.user_id AND web_notifications = false
  ) THEN
    RETURN NULL;   -- recipient opted out of in-web notifications
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_web_notification_pref ON public.notifications;
CREATE TRIGGER trg_enforce_web_notification_pref
  BEFORE INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.enforce_web_notification_pref();

-- ── Expose the prefs to the client via get_my_context() ─────────────
CREATE OR REPLACE FUNCTION public.get_my_context()
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid  uuid := auth.uid();
  v_prof profiles%ROWTYPE;
  v_ws   jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_prof FROM profiles WHERE id = v_uid;

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
      'id',                  v_prof.id,
      'name',                v_prof.name,
      'email',               v_prof.email,
      'avatar',              v_prof.avatar,
      'avatar_url',          v_prof.avatar_url,
      'joined_at',           v_prof.created_at,
      'email_notifications', v_prof.email_notifications,
      'web_notifications',   v_prof.web_notifications
    ),
    'workstations',          v_ws,
    'active_workstation_id', v_prof.active_workstation_id
  );
END;
$function$;

-- ── Self-service update of the prefs ────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_my_notification_prefs(
  p_email boolean,
  p_web   boolean
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  UPDATE public.profiles
     SET email_notifications = coalesce(p_email, email_notifications),
         web_notifications   = coalesce(p_web,   web_notifications)
   WHERE id = auth.uid();
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.update_my_notification_prefs(boolean, boolean) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.update_my_notification_prefs(boolean, boolean) TO authenticated;
