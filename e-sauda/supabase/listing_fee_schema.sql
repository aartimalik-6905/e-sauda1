-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- feature/real-listing-fee: the Sell wizard has always displayed an "anti-bot fee"
-- (₹1/₹10/₹25 depending on how many active listings you have in that category) but
-- never actually charged it -- confirmed and called out honestly on the Pricing page
-- (legal-pages branch). This makes it real, using the same trusted-payment pattern as
-- razorpay_schema.sql: a payment is only trustworthy if it was verified server-side,
-- and a listing can't be created without one.
--
-- Prerequisite: razorpay_schema.sql must already be applied (reuses its Razorpay
-- secrets; this migration only adds a new table and a new RPC, no shared code).

create table if not exists public.listing_fee_payments (
  id uuid primary key default gen_random_uuid(),
  razorpay_order_id text not null unique,
  razorpay_payment_id text not null,
  seller_id uuid references auth.users on delete cascade not null,
  category text not null,
  amount numeric not null,
  verified_at timestamptz not null default now(),
  consumed_at timestamptz
);

create index if not exists listing_fee_payments_seller_idx on public.listing_fee_payments (seller_id);

alter table public.listing_fee_payments enable row level security;

create policy "Users can view their own listing fee payments"
  on public.listing_fee_payments for select
  using (auth.uid() = seller_id);

-- Same reasoning as razorpay_payments: no insert/update policy for any ordinary role.
-- The only way a row lands here is the verify-listing-fee-payment Edge Function using
-- the service-role key, after actually checking a Razorpay signature.

-- CRITICAL: without this, a client could still call supabase.from('listings').insert()
-- directly, skipping the fee entirely -- the RPC above being SECURITY DEFINER means it
-- can insert regardless of this policy (same as create_vault_order already does for
-- vault_orders/listings), so removing ordinary INSERT access here doesn't break
-- anything that's actually meant to work; it just closes the one path that would let
-- someone skip paying.
drop policy if exists "Users can insert their own listings" on public.listings;

create or replace function public.create_listing_with_fee(
  p_razorpay_order_id text,
  p_title text,
  p_price numeric,
  p_category text,
  p_sub_category text,
  p_condition text,
  p_description text,
  p_city text,
  p_location text,
  p_width_cm numeric,
  p_height_cm numeric,
  p_depth_cm numeric,
  p_emoji text,
  p_bg text
)
returns public.listings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment record;
  v_listing public.listings;
begin
  select * into v_payment
  from public.listing_fee_payments
  where razorpay_order_id = p_razorpay_order_id
    and seller_id = auth.uid()
    and category = p_category
    and consumed_at is null
  for update;

  if v_payment is null then
    raise exception 'No verified listing fee payment found for this order';
  end if;

  update public.listing_fee_payments set consumed_at = now() where id = v_payment.id;

  insert into public.listings
    (owner_id, title, price, category, sub_category, condition, description, city,
     location, width_cm, height_cm, depth_cm, emoji, bg)
  values
    (auth.uid(), p_title, p_price, p_category, p_sub_category, p_condition, p_description,
     p_city, p_location, p_width_cm, p_height_cm, p_depth_cm, p_emoji, p_bg)
  returning * into v_listing;

  return v_listing;
end;
$$;

grant execute on function public.create_listing_with_fee(
  text, text, numeric, text, text, text, text, text, text, numeric, numeric, numeric, text, text
) to authenticated;
