-- ── 1. Add avatar_url column to profiles ──────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- ── 2. Create avatars storage bucket (public, 2 MB limit) ─────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- ── 3. Storage RLS policies ────────────────────────────────────────────────────
-- Public read — anyone can view avatars (they're profile pictures)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'avatars_public_select'
  ) THEN
    CREATE POLICY "avatars_public_select"
      ON storage.objects FOR SELECT TO public
      USING (bucket_id = 'avatars');
  END IF;
END$$;

-- Authenticated users can upload into their own folder ({user_id}/...)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'avatars_insert_own'
  ) THEN
    CREATE POLICY "avatars_insert_own"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END$$;

-- Authenticated users can overwrite/update their own folder
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'avatars_update_own'
  ) THEN
    CREATE POLICY "avatars_update_own"
      ON storage.objects FOR UPDATE TO authenticated
      USING (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END$$;

-- Authenticated users can delete their own avatars
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'avatars_delete_own'
  ) THEN
    CREATE POLICY "avatars_delete_own"
      ON storage.objects FOR DELETE TO authenticated
      USING (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END$$;

-- ── 4. RPC: update_my_avatar ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_my_avatar(p_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE profiles SET avatar_url = p_url WHERE id = auth.uid();
END;
$$;

-- ── 5. Rebuild get_my_context to include avatar_url ───────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_context()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
      'id',         v_prof.id,
      'name',       v_prof.name,
      'email',      v_prof.email,
      'avatar',     v_prof.avatar,
      'avatar_url', v_prof.avatar_url,
      'joined_at',  v_prof.created_at
    ),
    'workstations',          v_ws,
    'active_workstation_id', v_prof.active_workstation_id
  );
END;
$$;
