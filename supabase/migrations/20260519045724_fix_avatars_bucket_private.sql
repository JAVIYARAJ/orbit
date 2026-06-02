-- Fix: public_bucket_allows_listing for avatars
-- Make the bucket private so unauthenticated listing is not possible.
-- Individual avatar files are still accessible to authenticated users via
-- supabase.storage.from('avatars').createSignedUrl() or download() in the mobile app.

UPDATE storage.buckets SET public = false WHERE id = 'avatars';
