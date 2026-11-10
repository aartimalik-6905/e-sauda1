-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Companion to listing_geolocation_schema.sql: lets create_listing_with_fee
-- (supabase/listing_fee_schema.sql) actually populate the new latitude/
-- longitude columns at creation time, geocoded client-side from the seller's
-- free-text location (see src/lib/geocoding.ts) before this RPC is called.
--
-- Adding two new trailing parameters with DEFAULT values is a supported
-- CREATE OR REPLACE FUNCTION change in Postgres (it does not require
-- dropping the function first) -- the Sell wizard now always passes both,
-- but the defaults keep this backward compatible with any other caller.
--
-- Prerequisites: supabase/listing_fee_schema.sql and
-- supabase/listing_geolocation_schema.sql must already be applied.

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
  p_bg text,
  p_latitude double precision default null,
  p_longitude double precision default null
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
     location, width_cm, height_cm, depth_cm, emoji, bg, latitude, longitude)
  values
    (auth.uid(), p_title, p_price, p_category, p_sub_category, p_condition, p_description,
     p_city, p_location, p_width_cm, p_height_cm, p_depth_cm, p_emoji, p_bg, p_latitude, p_longitude)
  returning * into v_listing;

  return v_listing;
end;
$$;

grant execute on function public.create_listing_with_fee(
  text, text, numeric, text, text, text, text, text, text, numeric, numeric, numeric, text, text,
  double precision, double precision
) to authenticated;
