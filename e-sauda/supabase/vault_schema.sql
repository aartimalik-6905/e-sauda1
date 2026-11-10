-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- feature/escrow-vault: the "Buy with Vault" flow — buyer's payment is held, seller
-- sees FUNDS SECURED, handover happens via an OTP only the buyer can see, and either
-- party can cancel before handover.
--
-- HONEST SCOPE NOTE: no real money moves in this branch. "Funding" a vault order just
-- creates a database row — there's no payment gateway call. Real escrow (actually
-- holding real rupees) requires a registered, KYC'd account with a gateway like
-- Razorpay/Stripe, which isn't something that can be wired up for free. Everything
-- else here IS real: real database rows, real per-user access control enforced at the
-- database level (not just hidden in the UI), and real state transitions. Swapping in
-- a real gateway later means adding a payment-confirmation step before
-- create_vault_order runs — nothing else in this flow needs to change.

create extension if not exists pgcrypto;

create table if not exists public.vault_orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings on delete cascade not null,
  buyer_id uuid references auth.users on delete cascade not null,
  seller_id uuid references auth.users on delete cascade not null,
  amount numeric not null check (amount >= 0),
  status text not null default 'funded' check (status in ('funded', 'completed', 'cancelled')),
  handover_otp text not null,
  cancel_reason text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz
);

-- Only one non-cancelled order per listing at a time — a listing can't be "in escrow"
-- for two different buyers simultaneously. Enforced at the DB level, not just in the
-- application, so it holds even under concurrent requests.
create unique index if not exists vault_orders_one_active_per_listing
  on public.vault_orders (listing_id)
  where status <> 'cancelled';

create index if not exists vault_orders_buyer_idx on public.vault_orders (buyer_id);
create index if not exists vault_orders_seller_idx on public.vault_orders (seller_id);

alter table public.vault_orders enable row level security;

create policy "Participants can view their vault orders"
  on public.vault_orders for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

-- Deliberately no insert/update policy for ordinary authenticated users. Every write
-- goes through the SECURITY DEFINER functions below, which enforce the real rules
-- atomically (can't buy your own listing, listing must still be active, OTP must
-- match, only the current holder of a row can act on it, etc.) instead of trusting
-- the client to send correct data.

-- This is what actually keeps the handover OTP hidden from the seller: even though
-- both buyer and seller can SELECT their shared row (policy above), neither role can
-- read the handover_otp column directly — only the SECURITY DEFINER functions can,
-- because they run with the function owner's privileges, not the caller's.
revoke select (handover_otp) on public.vault_orders from authenticated, anon;

-- 1. Buyer taps "Buy with Vault" on a listing detail page.
create or replace function public.create_vault_order(p_listing_id uuid)
returns public.vault_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing record;
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

  v_otp := lpad(floor(random() * 900000 + 100000)::text, 6, '0');

  insert into public.vault_orders (listing_id, buyer_id, seller_id, amount, handover_otp)
  values (p_listing_id, auth.uid(), v_listing.owner_id, v_listing.price, v_otp)
  returning * into v_order;

  update public.listings set status = 'sold' where id = p_listing_id;

  return v_order;
end;
$$;

-- 2. Buyer checking the OTP again later (e.g. they left the app before the meetup).
create or replace function public.get_handover_otp(p_order_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_otp text;
begin
  select handover_otp into v_otp
  from public.vault_orders
  where id = p_order_id and buyer_id = auth.uid() and status = 'funded';

  if v_otp is null then
    raise exception 'OTP not available for this order';
  end if;

  return v_otp;
end;
$$;

-- 3. Seller enters the OTP the buyer read out in person, releasing the funds.
create or replace function public.confirm_handover(p_order_id uuid, p_entered_otp text)
returns public.vault_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.vault_orders;
begin
  select * into v_order from public.vault_orders where id = p_order_id for update;

  if v_order is null or v_order.seller_id <> auth.uid() then
    raise exception 'Order not found';
  end if;
  if v_order.status <> 'funded' then
    raise exception 'This order is not awaiting handover';
  end if;
  if v_order.handover_otp <> p_entered_otp then
    raise exception 'Incorrect OTP';
  end if;

  update public.vault_orders
  set status = 'completed', completed_at = now()
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

-- 4. Either party cancels before handover (e.g. buyer inspects and rejects the item).
create or replace function public.cancel_vault_order(p_order_id uuid, p_reason text)
returns public.vault_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.vault_orders;
begin
  select * into v_order from public.vault_orders where id = p_order_id for update;

  if v_order is null or (v_order.buyer_id <> auth.uid() and v_order.seller_id <> auth.uid()) then
    raise exception 'Order not found';
  end if;
  if v_order.status <> 'funded' then
    raise exception 'This order can no longer be cancelled';
  end if;

  update public.vault_orders
  set status = 'cancelled', cancelled_at = now(), cancel_reason = p_reason
  where id = p_order_id
  returning * into v_order;

  update public.listings set status = 'active' where id = v_order.listing_id and status = 'sold';

  return v_order;
end;
$$;

grant execute on function public.create_vault_order(uuid) to authenticated;
grant execute on function public.get_handover_otp(uuid) to authenticated;
grant execute on function public.confirm_handover(uuid, text) to authenticated;
grant execute on function public.cancel_vault_order(uuid, text) to authenticated;
