-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- fix/vault-listing-removed: the Vault page was showing a bare "Listing removed"
-- with no name for any listing that isn't currently 'active' -- which included every
-- *sold* listing (i.e. almost every completed purchase!), not just genuinely
-- moderator-removed ones.
--
-- Root cause: `listings` RLS only lets non-owners SELECT rows where status = 'active'
-- (see listings_schema.sql). The buyer/seller of a Vault order can still see their
-- *own* vault_orders row, but the embedded `listings(title, emoji, photo_urls)` join
-- silently comes back null the moment the listing's status flips away from 'active'
-- (e.g. the instant a purchase completes, via create_vault_order's own
-- `update listings set status = 'sold'`) -- so this wasn't even an edge case, it hit
-- basically every order.
--
-- Two-part fix:
-- 1. A new RLS policy lets the buyer/seller of a vault order see that listing
--    regardless of its current status -- this is the real fix and covers 'sold' and
--    'removed' alike, going forward and retroactively for existing orders.
-- 2. Belt-and-suspenders: snapshot the title/emoji/photo onto vault_orders itself at
--    purchase time, so the name still survives even in a hypothetical future where
--    the listing row is hard-deleted outright (today `listing_id ... on delete
--    cascade` means that actually deletes the order row too, so this can't happen
--    yet, but it costs nothing to store and removes the dependency).
--
-- Prerequisite: vault_schema.sql AND razorpay_schema.sql already applied (this
-- file's create_vault_order redefinition below builds directly on the version in
-- razorpay_schema.sql, and must run after it).

alter table public.vault_orders
  add column if not exists listing_title_snapshot text,
  add column if not exists listing_emoji_snapshot text,
  add column if not exists listing_photo_url_snapshot text;

comment on column public.vault_orders.listing_title_snapshot is
  'Listing title captured at the moment of purchase, so the Vault page can always show a real name even if the listing later becomes invisible to one side under listings RLS (or, if the schema ever changes to allow it, gets deleted).';

-- Backfill existing orders from whatever the join can still see right now (own
-- listings, or listings still 'active') -- anything it can't see stays null and
-- just falls back to the RLS fix above once that's applied.
update public.vault_orders vo
set
  listing_title_snapshot = l.title,
  listing_emoji_snapshot = l.emoji,
  listing_photo_url_snapshot = l.photo_urls[1]
from public.listings l
where l.id = vo.listing_id
  and vo.listing_title_snapshot is null;

-- Lets both sides of a Vault order always see that listing's display info (title,
-- emoji, photos), no matter what its current status is -- this is what actually
-- stops "Listing removed" from showing up for ordinary sold listings.
drop policy if exists "Vault order participants can view the listing" on public.listings;
create policy "Vault order participants can view the listing"
  on public.listings for select
  using (
    exists (
      select 1 from public.vault_orders v
      where v.listing_id = listings.id
        and (v.buyer_id = auth.uid() or v.seller_id = auth.uid())
    )
  );

-- Captures the snapshot at purchase time going forward.
--
-- IMPORTANT: this must match the exact signature of the function that's actually
-- live and called by the app -- create_vault_order(p_listing_id uuid, p_razorpay_
-- order_id text), defined in razorpay_schema.sql. `create or replace` only
-- overwrites a function with the *identical* argument signature; an earlier
-- version of this file mistakenly redefined create_vault_order(p_listing_id uuid)
-- (the single-argument form) instead. That form has no payment-verification step
-- at all, and razorpay_schema.sql explicitly DROPs it for exactly that reason
-- ("anyone could still call it to get a free listing") -- so redefining it here
-- would have silently reopened that hole. This version replaces the real
-- two-argument function in place, preserving every one of its existing checks
-- (payment must be verified, amount must match, listing must be active, can't buy
-- your own listing) and only adding the three snapshot columns to what it inserts.
create or replace function public.create_vault_order(p_listing_id uuid, p_razorpay_order_id text)
returns public.vault_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing record;
  v_payment record;
  v_otp text;
  v_order public.vault_orders;
begin
  select * into v_listing from public.listings where id = p_listing_id for update;

  if v_listing is null then
    raise exception 'Listing not found';
  end if;
  if v_listing.owner_id = auth.uid() then
    raise exception 'You cannot buy your own listing';
  end if;
  if v_listing.status <> 'active' then
    raise exception 'This listing is no longer available';
  end if;

  select * into v_payment
  from public.razorpay_payments
  where razorpay_order_id = p_razorpay_order_id
    and listing_id = p_listing_id
    and buyer_id = auth.uid()
    and consumed_at is null
  for update;

  if v_payment is null then
    raise exception 'No verified payment found for this order';
  end if;
  if v_payment.amount <> v_listing.price then
    raise exception 'Payment amount does not match listing price';
  end if;

  update public.razorpay_payments set consumed_at = now() where id = v_payment.id;

  v_otp := lpad(floor(random() * 900000 + 100000)::text, 6, '0');

  insert into public.vault_orders (
    listing_id, buyer_id, seller_id, amount, handover_otp,
    razorpay_order_id, razorpay_payment_id,
    listing_title_snapshot, listing_emoji_snapshot, listing_photo_url_snapshot
  )
  values (
    p_listing_id, auth.uid(), v_listing.owner_id, v_listing.price, v_otp,
    v_payment.razorpay_order_id, v_payment.razorpay_payment_id,
    v_listing.title, v_listing.emoji, v_listing.photo_urls[1]
  )
  returning * into v_order;

  update public.listings set status = 'sold' where id = p_listing_id;

  return v_order;
end;
$$;

grant execute on function public.create_vault_order(uuid, text) to authenticated;
