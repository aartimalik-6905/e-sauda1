-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- This creates the real `listings` table so posts made in /sell persist and
-- show up in /browse, Home's "Fresh in your city", and "My listings".

-- Needed for gen_random_uuid() below. Usually already on in Supabase, safe to re-run.
create extension if not exists pgcrypto;

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users on delete cascade not null,
  title text not null,
  price numeric not null check (price >= 0),
  category text not null,
  sub_category text,
  condition text not null default 'Good',
  description text,
  city text,
  location text not null default '',
  distance_km numeric not null default 0,
  emoji text not null default '📦',
  bg text not null default 'bg-neutral-200',
  status text not null default 'active' check (status in ('active', 'sold', 'removed')),
  created_at timestamptz not null default now()
);

-- Speeds up the common "browse by category" and "my listings" queries.
create index if not exists listings_category_idx on public.listings (category);
create index if not exists listings_owner_idx on public.listings (owner_id);

-- Row Level Security: without this, any logged-in user could edit or delete
-- anyone else's listing.
alter table public.listings enable row level security;

create policy "Active listings are viewable by everyone"
  on public.listings for select
  using (status = 'active' or owner_id = auth.uid());

create policy "Users can insert their own listings"
  on public.listings for insert
  with check (auth.uid() = owner_id);

create policy "Users can update their own listings"
  on public.listings for update
  using (auth.uid() = owner_id);

create policy "Users can delete their own listings"
  on public.listings for delete
  using (auth.uid() = owner_id);
