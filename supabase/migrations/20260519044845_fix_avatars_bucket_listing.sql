-- Fix: public_bucket_allows_listing for avatars bucket
-- Change SELECT policy from public (anyone) to authenticated only.
-- Individual avatar URLs via /storage/v1/object/public/avatars/... still work for unauthenticated access.
-- Only bucket enumeration/listing is now restricted to authenticated users.

DROP POLICY IF EXISTS "avatars_public_select" ON storage.objects;

CREATE POLICY "avatars_authenticated_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'avatars');
