-- DogMeetDog storage bucket for dog photos.
-- Safe to run multiple times.

insert into storage.buckets (id, name, public)
values ('dog-photos', 'dog-photos', true)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public;

drop policy if exists "Public can read dog photos" on storage.objects;
create policy "Public can read dog photos"
on storage.objects
for select
to public
using (bucket_id = 'dog-photos');

drop policy if exists "Authenticated users can upload dog photos" on storage.objects;
create policy "Authenticated users can upload dog photos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'dog-photos'
  and name like auth.uid()::text || '/%'
);