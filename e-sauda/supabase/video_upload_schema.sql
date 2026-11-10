-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run.
--
-- *** THIS FILE WAS PREVIOUSLY BROKEN ***
-- It had been accidentally overwritten with a byte-for-byte duplicate of
-- report_notify_schema.sql at some point (confirmed via `diff` -- they were
-- identical). This means the listing-videos storage bucket and the
-- listings.video_url column were likely NEVER created in your live database,
-- which is almost certainly why video uploads have been failing -- the frontend
-- code correctly tries to upload to a bucket and column that don't exist.
--
-- Re-run this corrected version now. It's safe to run even if some pieces
-- already exist (everything below uses if-not-exists / on-conflict guards).

alter table public.listings
  add column if not exists video_url text;

insert into storage.buckets (id, name, public)
values ('listing-videos', 'listing-videos', true)
on conflict (id) do nothing;

drop policy if exists "Anyone can view listing videos" on storage.objects;
create policy "Anyone can view listing videos"
  on storage.objects for select
  using (bucket_id = 'listing-videos');

drop policy if exists "Users can upload videos into their own folder" on storage.objects;
create policy "Users can upload videos into their own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'listing-videos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can delete their own listing videos" on storage.objects;
create policy "Users can delete their own listing videos"
  on storage.objects for delete
  using (
    bucket_id = 'listing-videos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
