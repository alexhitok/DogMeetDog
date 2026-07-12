-- Add missing cleanup policy for dog photo uploads.
-- This allows authenticated users to delete their own uploaded objects from the dog-photos bucket.

drop policy if exists "Authenticated users can delete dog photos" on storage.objects;
create policy "Authenticated users can delete dog photos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'dog-photos'
  and name like auth.uid()::text || '/%'
);