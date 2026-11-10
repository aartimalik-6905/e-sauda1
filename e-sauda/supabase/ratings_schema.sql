-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- feature/ratings: after a Vault order completes, either party can rate the other.
-- Ratings feed the trust_score already shown on Profile (previously a static 50 for
-- everyone) and a public rating average/count.
--
-- Prerequisite: supabase/vault_schema.sql must already be applied (ratings reference
-- vault_orders to confirm a real completed transaction happened).

create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists rating_avg numeric,
  add column if not exists rating_count int not null default 0;

create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  vault_order_id uuid references public.vault_orders on delete cascade not null,
  rater_id uuid references auth.users on delete cascade not null,
  rated_user_id uuid references auth.users on delete cascade not null,
  stars smallint not null check (stars between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  -- One rating per person per transaction — can't rate the same order twice.
  unique (vault_order_id, rater_id)
);

create index if not exists ratings_rated_user_idx on public.ratings (rated_user_id);

alter table public.ratings enable row level security;

-- Ratings are public — they're what makes the trust score and review count on a
-- seller's profile meaningful to other buyers.
create policy "Anyone can view ratings"
  on public.ratings for select
  using (true);

-- Deliberately no insert policy for ordinary authenticated users — every write goes
-- through submit_rating() below, which atomically verifies the order is real,
-- completed, and that the caller was actually part of it before accepting a rating.

-- Rates the OTHER party in a completed Vault order. Determines who that is from the
-- order itself (never trusts a client-supplied "who I'm rating" value), updates the
-- rated user's aggregate rating, and nudges trust_score — capped at [0, 100] and
-- weighted gently (2 points per star away from a neutral 3) so one rating can't swing
-- the score wildly.
create or replace function public.submit_rating(
  p_vault_order_id uuid,
  p_stars smallint,
  p_comment text default null
)
returns public.ratings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.vault_orders;
  v_rated_user_id uuid;
  v_rating public.ratings;
begin
  if p_stars < 1 or p_stars > 5 then
    raise exception 'Rating must be between 1 and 5 stars';
  end if;

  select * into v_order from public.vault_orders where id = p_vault_order_id;
  if v_order is null then
    raise exception 'Order not found';
  end if;
  if v_order.status <> 'completed' then
    raise exception 'You can only rate a completed transaction';
  end if;

  if auth.uid() = v_order.buyer_id then
    v_rated_user_id := v_order.seller_id;
  elsif auth.uid() = v_order.seller_id then
    v_rated_user_id := v_order.buyer_id;
  else
    raise exception 'You were not part of this transaction';
  end if;

  insert into public.ratings (vault_order_id, rater_id, rated_user_id, stars, comment)
  values (p_vault_order_id, auth.uid(), v_rated_user_id, p_stars, p_comment)
  returning * into v_rating;

  update public.profiles
  set
    rating_count = rating_count + 1,
    rating_avg = (coalesce(rating_avg, 3) * rating_count + p_stars) / (rating_count + 1),
    trust_score = greatest(0, least(100, trust_score + (p_stars - 3) * 2))
  where id = v_rated_user_id;

  return v_rating;
end;
$$;

grant execute on function public.submit_rating(uuid, smallint, text) to authenticated;
