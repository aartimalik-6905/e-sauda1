-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- feature/reports: lets a buyer flag a listing or a seller's account for review.
-- There's no admin UI yet -- reports land in this table for now and can be reviewed
-- directly in the Supabase table editor, or Postgres RLS filtered by `status`. An
-- admin dashboard is a natural next feature once report volume justifies building one.

create extension if not exists pgcrypto;

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users on delete cascade not null,
  -- Both nullable and independent: a report can be about a specific listing, a user's
  -- account in general, or both (e.g. reporting a listing also names its seller).
  listing_id uuid references public.listings on delete set null,
  reported_user_id uuid references auth.users on delete cascade,
  reason text not null check (
    reason in ('scam_or_fraud', 'prohibited_item', 'misleading', 'harassment', 'spam', 'other')
  ),
  details text,
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now(),
  constraint reports_target_present check (listing_id is not null or reported_user_id is not null)
);

create index if not exists reports_status_idx on public.reports (status, created_at desc);
create index if not exists reports_reported_user_idx on public.reports (reported_user_id);

alter table public.reports enable row level security;

-- Anyone logged in can file a report, but only as themselves -- no filing on someone
-- else's behalf, and no way to guess who else reported the same thing.
create policy "Users can file their own reports"
  on public.reports for insert
  with check (auth.uid() = reporter_id);

-- A reporter can see their own report history (e.g. to know they already reported
-- something), but not anyone else's reports -- reports are not public information,
-- both to protect reporters from retaliation and to avoid tipping off the person
-- being reported.
create policy "Users can view their own filed reports"
  on public.reports for select
  using (auth.uid() = reporter_id);

-- Deliberately no update/delete policy for ordinary users -- once filed, a report is
-- immutable from the reporter's side. Only a service-role key (used by an admin tool,
-- not exposed to the browser) can change `status`, which bypasses RLS entirely.
