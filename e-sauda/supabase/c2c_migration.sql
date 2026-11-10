-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run, AFTER the earlier
-- schema files. It converts the database from the escrow ("Sauda Vault") model to the
-- C2C classifieds model: buyers and sellers deal and pay each other directly, and the
-- only payment e-Sauda takes is the seller's listing fee.
--
-- WHAT THIS DELETES: the vault_orders, deliveries, meetups and razorpay_payments tables
-- (and their rows), the Vault/delivery/meetup functions and triggers, and notification
-- rows of the removed types. If you have real vault orders you need to keep for
-- records, export them first (Table Editor -> vault_orders -> Export). The Vault was
-- never live with real money, so for a fresh launch this is safe.
--
-- WHAT THIS KEEPS: listings, chat (conversations/messages/chat_offers), reports,
-- blocking, saved items, profiles, and listing_fee_payments + create_listing_with_fee
-- (the listing fee flow).
--
-- Safe to re-run: everything uses "if exists" / "if not exists".

begin;

-- 1. Ratings: key them to a chat instead of a vault order -------------------------
-- A rating is now allowed once the listing is marked as sold, from either person in a
-- chat about that listing, one rating per person per chat. Existing rating rows (and
-- the rating_avg / rating_count / trust_score they already fed) are kept as-is.
alter table public.ratings
  add column if not exists conversation_id uuid references public.conversations on delete cascade;

-- Dropping the column also drops the old unique (vault_order_id, rater_id) constraint.
alter table public.ratings drop column if exists vault_order_id;

create unique index if not exists ratings_conversation_rater_idx
  on public.ratings (conversation_id, rater_id);

drop function if exists public.submit_rating(uuid, smallint, text);

create or replace function public.submit_rating(
  p_conversation_id uuid,
  p_stars smallint,
  p_comment text default null
)
returns public.ratings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv public.conversations;
  v_listing_status text;
  v_rated_user_id uuid;
  v_rating public.ratings;
begin
  if p_stars < 1 or p_stars > 5 then
    raise exception 'Rating must be between 1 and 5 stars';
  end if;

  select * into v_conv from public.conversations where id = p_conversation_id;
  if v_conv is null then
    raise exception 'Conversation not found';
  end if;

  select status into v_listing_status from public.listings where id = v_conv.listing_id;
  if v_listing_status is distinct from 'sold' then
    raise exception 'You can rate once the item has been marked as sold';
  end if;

  -- Who is being rated comes from the conversation itself, never from the client.
  if auth.uid() = v_conv.buyer_id then
    v_rated_user_id := v_conv.seller_id;
  elsif auth.uid() = v_conv.seller_id then
    v_rated_user_id := v_conv.buyer_id;
  else
    raise exception 'You were not part of this conversation';
  end if;

  insert into public.ratings (conversation_id, rater_id, rated_user_id, stars, comment)
  values (p_conversation_id, auth.uid(), v_rated_user_id, p_stars, p_comment)
  returning * into v_rating;

  -- Same gentle weighting as before: 2 trust points per star away from a neutral 3.
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

-- 2. Notifications: remove vault / meetup types ---------------------------------
delete from public.notifications
where type in (
  'vault_funded', 'vault_completed', 'vault_cancelled',
  'meetup_proposed', 'meetup_confirmed', 'meetup_cancelled'
);

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (
  type in ('message', 'report_reviewed', 'report_dismissed', 'price_drop')
);

-- 3. Drop the Vault, delivery, meetup and purchase-payment machinery -------------
drop trigger if exists on_vault_order_change on public.vault_orders;
drop trigger if exists on_meetup_change on public.meetups;

drop function if exists public.notify_vault_status();
drop function if exists public.notify_meetup_change();
drop function if exists public.create_vault_order(uuid);
drop function if exists public.create_vault_order(uuid, text);
drop function if exists public.get_handover_otp(uuid);
drop function if exists public.confirm_handover(uuid, text);
drop function if exists public.cancel_vault_order(uuid, text);
drop function if exists public.arrange_delivery(uuid);
drop function if exists public.mark_delivered(uuid);

drop table if exists public.meetups cascade;
drop table if exists public.deliveries cascade;
drop table if exists public.vault_orders cascade;
drop table if exists public.razorpay_payments cascade;

commit;
