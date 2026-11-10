-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- feature/admin-reports: a minimal /admin page for reviewing reports filed via
-- feature/edit-listing-and-reports, instead of digging through the Table Editor by hand.
--
-- Requires supabase/reports_schema.sql to already be applied.

-- 1. Mark yourself (or anyone) as an admin. Deliberately just a boolean on `profiles`
-- rather than a separate roles table -- this app has one admin role, not a matrix of
-- permissions, so a roles table would be solving a problem this app doesn't have yet.
alter table public.profiles add column if not exists is_admin boolean not null default false;

-- Run this once, replacing the email, to make your own account an admin:
--
--   update public.profiles set is_admin = true
--   where id = (select id from auth.users where email = 'you@example.com');

-- Small helper so the RLS policies below don't each repeat the same subquery, and so
-- there's exactly one place that defines "what counts as an admin" if that ever
-- changes (e.g. to a real roles table later).
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- 2. Let admins see every report, not just their own filed ones.
create policy "Admins can view all reports"
  on public.reports for select
  using (public.is_admin());

-- 3. Let admins update a report's status (open -> reviewed/dismissed) directly from
-- the app, instead of needing the Supabase dashboard for every single one.
create policy "Admins can update report status"
  on public.reports for update
  using (public.is_admin())
  with check (public.is_admin());

-- 4. Let admins see a reported listing even if it's sold/removed, so a report about a
-- listing that's since been taken down is still reviewable instead of showing as blank.
create policy "Admins can view all listings"
  on public.listings for select
  using (public.is_admin());
