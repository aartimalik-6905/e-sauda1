-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run.
--
-- Bug this fixes: the Sell wizard used to (1) create the listing row via
-- create_listing_with_fee, making it immediately active/visible, and only
-- *afterwards* upload photos/video and attach them with separate calls
-- (attachPhotos / updateListingVideo). If either of those later uploads
-- failed -- a dropped connection, a closed tab, a flaky mobile network --
-- the listing was already live with no photos and/or no video, even though
-- a video is supposed to be mandatory for every new listing (see
-- video_upload_schema.sql). Buyers could open a "published" listing and find
-- it missing the media that convinced them to click it in the first place.
--
-- Fix: photos and video now upload to storage *before* the listing row is
-- created (see src/pages/Sell.tsx's publish()), and their URLs are passed
-- straight into this RPC so the row is inserted already complete. There's no
-- longer a window where an active listing can exist without the video it
-- was published with. p_id lets the client generate the row's id up front
-- (matching the storage folder the media was already uploaded under) instead
-- of only finding out the id after the fact.
--
-- Adding new trailing parameters with DEFAULT values is a supported
-- CREATE OR REPLACE FUNCTION change in Postgres (no need to drop the function
-- first) -- existing callers that don't pass them keep working exactly as
-- before.
--
-- Prerequisite: supabase/create_listing_with_fee_geolocation.sql must already
-- be applied.

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
    (id, owner_id, title, price, category, sub_category, condition, description, city,
     location, width_cm, height_cm, depth_cm, emoji, bg, latitude, longitude,
     photo_urls, video_url)
  values
    (coalesce(p_id, gen_random_uuid()), auth.uid(), p_title, p_price, p_category, p_sub_category,
     p_condition, p_description, p_city, p_location, p_width_cm, p_height_cm, p_depth_cm, p_emoji,
     p_bg, p_latitude, p_longitude, coalesce(p_photo_urls, '{}'), p_video_url)
  returning * into v_listing;

  return v_listing;
end;
$$;

grant execute on function public.create_listing_with_fee(
  text, text, numeric, text, text, text, text, text, text, numeric, numeric, numeric, text, text,
  double precision, double precision, uuid, text[], text
) to authenticated;
