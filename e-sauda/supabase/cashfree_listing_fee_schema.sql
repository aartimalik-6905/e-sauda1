-- Cashfree listing-fee migration.
-- Apply after the existing listing_fee_schema.sql,
-- create_listing_with_fee_geolocation.sql and create_listing_with_media_schema.sql.
-- This is additive: historical Razorpay/Vault tables are intentionally not dropped.

create table if not exists public.cashfree_listing_fee_payments (
  id uuid primary key default gen_random_uuid(),
  cashfree_order_id text not null unique,
  cashfree_payment_id text,
  payment_session_id text,
  listing_id uuid not null,
  seller_id uuid references auth.users on delete cascade not null,
  category text not null,
  amount numeric(10,2) not null check (amount in (1, 10, 25)),
  currency text not null default 'INR' check (currency = 'INR'),
  status text not null default 'CREATING'
    check (status in ('CREATING', 'PENDING', 'PAID', 'FAILED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  consumed_at timestamptz
);

create index if not exists cashfree_listing_fee_payments_seller_idx
  on public.cashfree_listing_fee_payments (seller_id);
create index if not exists cashfree_listing_fee_payments_listing_idx
  on public.cashfree_listing_fee_payments (listing_id);

-- At most one active payment attempt may exist for a listing. Failed attempts
-- are retained for audit but do not prevent a later retry.
create unique index if not exists cashfree_one_open_payment_per_listing
  on public.cashfree_listing_fee_payments (listing_id)
  where status in ('CREATING', 'PENDING', 'PAID');

alter table public.cashfree_listing_fee_payments enable row level security;

drop policy if exists "Users can view their own Cashfree listing fee payments"
  on public.cashfree_listing_fee_payments;
create policy "Users can view their own Cashfree listing fee payments"
  on public.cashfree_listing_fee_payments for select
  using (auth.uid() = seller_id);

-- Only Edge Functions using the service role can insert/update payment records.
revoke insert, update, delete on public.cashfree_listing_fee_payments from anon, authenticated;

-- Atomic listing creation: only an authenticated seller can consume their own
-- server-verified PAID Cashfree order, and the payment is bound to this listing ID.
create or replace function public.create_listing_with_cashfree_fee(
  p_cashfree_order_id text,
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
  p_bg text,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_id uuid default null,
  p_photo_urls text[] default null,
  p_video_url text default null
)
returns public.listings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.cashfree_listing_fee_payments%rowtype;
  v_listing public.listings%rowtype;
begin
  if p_id is null then
    raise exception 'Listing ID is required for payment verification';
  end if;

  select * into v_payment
  from public.cashfree_listing_fee_payments
  where cashfree_order_id = p_cashfree_order_id
    and listing_id = p_id
    and seller_id = auth.uid()
    and category = p_category
    and status = 'PAID'
    and consumed_at is null
  for update;

  if not found then
    -- Idempotent retry: if the first publish committed but its response was lost,
    -- return the already-created listing rather than asking the seller to pay again.
    select * into v_listing
    from public.listings
    where id = p_id and owner_id = auth.uid();
    if found then
      return v_listing;
    end if;
    raise exception 'No verified, unused Cashfree payment found for this listing';
  end if;

  insert into public.listings
    (id, owner_id, title, price, category, sub_category, condition, description, city,
     location, width_cm, height_cm, depth_cm, emoji, bg, latitude, longitude,
     photo_urls, video_url)
  values
    (p_id, auth.uid(), p_title, p_price, p_category, p_sub_category, p_condition, p_description,
     p_city, p_location, p_width_cm, p_height_cm, p_depth_cm, p_emoji, p_bg,
     p_latitude, p_longitude, coalesce(p_photo_urls, '{}'), p_video_url)
  returning * into v_listing;

  update public.cashfree_listing_fee_payments
  set consumed_at = now(), updated_at = now()
  where id = v_payment.id;

  return v_listing;
end;
$$;


grant execute on function public.create_listing_with_cashfree_fee(
  text, text, numeric, text, text, text, text, text, text, numeric, numeric, numeric, text, text,
  double precision, double precision, uuid, text[], text
) to authenticated;
