-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- feature/image-upload: lets sellers attach real photos to a listing, stored in
-- Supabase Storage (free tier — 1GB storage, 2GB bandwidth/month on the free plan,
-- plenty for development and small-scale use).

-- 1. Add a column to hold the public URLs of a listing's photos.
alter table public.listings
  add column if not exists photo_urls text[] not null default '{}';

-- 2. Create the storage bucket photos will live in. `public = true` means anyone
--    can VIEW a photo via its URL (fine — these are product photos meant to be seen),
--    but the policies below still control who can UPLOAD or DELETE.
insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', true)
on conflict (id) do nothing;

-- 3. Storage policies. Files are stored under a path like:
--      {owner_id}/{listing_id}/{filename}
--    so (storage.foldername(name))[1] gives us the owner_id segment of the path,
--    which is what lets us check "is this the same person who's uploading?".

create policy "Anyone can view listing photos"
  on storage.objects for select
  using (bucket_id = 'listing-photos');

create policy "Users can upload photos into their own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'listing-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete their own listing photos"
  on storage.objects for delete
  using (
    bucket_id = 'listing-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
