-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- feature/saved-items: lets a user save (❤️) a listing to a personal wishlist,
-- visible from the navbar's "Saved" link and counted on their Profile.

create extension if not exists pgcrypto;

create table if not exists public.saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  listing_id uuid references public.listings on delete cascade not null,
  created_at timestamptz not null default now(),
  -- Saving the same listing twice just no-ops instead of creating a duplicate row.
  unique (user_id, listing_id)
);

create index if not exists saved_items_user_idx on public.saved_items (user_id);

alter table public.saved_items enable row level security;

-- A wishlist is private — only you can see, add to, or remove from your own.
create policy "Users can view their own saved items"
  on public.saved_items for select
  using (auth.uid() = user_id);

create policy "Users can save listings for themselves"
  on public.saved_items for insert
  with check (auth.uid() = user_id);

create policy "Users can remove their own saved items"
  on public.saved_items for delete
  using (auth.uid() = user_id);
