-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- feature/delivery: mock Rapido/Uber/Dunzo-style delivery arrangement, as an
-- alternative to meeting the seller in person once a Vault order is funded.

-- HONEST SCOPE NOTE: no real courier is dispatched. "Arranging delivery" picks a mock
-- partner and generates a plausible ETA/fee — there's no real transit API call, since
-- integrating Rapido/Uber/Dunzo requires a business partnership agreement with each of
-- them, not something available to wire up directly. This keeps the same real-vs-mocked
-- split as the vault feature: real rows, real access control, real state transitions —
-- just no real-world dispatch behind it.

create extension if not exists pgcrypto;

create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  vault_order_id uuid references public.vault_orders on delete cascade not null unique,
  buyer_id uuid references auth.users on delete cascade not null,
  seller_id uuid references auth.users on delete cascade not null,
  partner text not null check (partner in ('Rapido', 'Uber', 'Dunzo')),
  eta_minutes int not null,
  distance_km numeric not null,
  fee numeric not null,
  status text not null default 'assigned' check (status in ('assigned', 'delivered', 'cancelled')),
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);

create index if not exists deliveries_buyer_idx on public.deliveries (buyer_id);
create index if not exists deliveries_seller_idx on public.deliveries (seller_id);

alter table public.deliveries enable row level security;

create policy "Participants can view their deliveries"
  on public.deliveries for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

-- As with vault_orders, no direct insert/update policy — everything goes through the
-- functions below so the real rules (order must be funded, only the buyer arranges
-- delivery, one delivery per order, only the buyer marks it delivered) are enforced
-- atomically rather than trusted from the client.

create or replace function public.arrange_delivery(p_vault_order_id uuid)
returns public.deliveries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_listing record;
  v_partner text;
  v_eta int;
  v_fee numeric;
  v_delivery public.deliveries;
  v_partners text[] := array['Rapido', 'Uber', 'Dunzo'];
begin
  select * into v_order from public.vault_orders where id = p_vault_order_id for update;

  if v_order is null then
    raise exception 'Order not found';
  end if;
  if v_order.buyer_id <> auth.uid() then
    raise exception 'Only the buyer can arrange delivery';
  end if;
  if v_order.status <> 'funded' then
    raise exception 'Delivery can only be arranged while funds are secured, before handover';
  end if;
  if exists (select 1 from public.deliveries where vault_order_id = p_vault_order_id) then
    raise exception 'Delivery has already been arranged for this order';
  end if;

  select * into v_listing from public.listings where id = v_order.listing_id;

  v_partner := v_partners[1 + floor(random() * 3)::int];
  v_eta := 8 + floor(random() * 37)::int; -- 8–45 minutes
  v_fee := round((25 + coalesce(v_listing.distance_km, 3) * 8)::numeric, 0);

  insert into public.deliveries (
    vault_order_id, buyer_id, seller_id, partner, eta_minutes, distance_km, fee
  )
  values (
    p_vault_order_id, v_order.buyer_id, v_order.seller_id, v_partner, v_eta,
    coalesce(v_listing.distance_km, 3), v_fee
  )
  returning * into v_delivery;

  return v_delivery;
end;
$$;

-- Buyer confirms the item arrived. This does NOT release the vault funds — that still
-- requires the same OTP handover as an in-person meetup (the rider is assumed to relay
-- the OTP between buyer and seller, same as the buyer would in person). Keeping these
-- two steps separate means this branch doesn't need to touch the vault RPCs at all.
create or replace function public.mark_delivered(p_delivery_id uuid)
returns public.deliveries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery public.deliveries;
begin
  select * into v_delivery from public.deliveries where id = p_delivery_id for update;

  if v_delivery is null or v_delivery.buyer_id <> auth.uid() then
    raise exception 'Delivery not found';
  end if;
  if v_delivery.status <> 'assigned' then
    raise exception 'This delivery is not awaiting confirmation';
  end if;

  update public.deliveries
  set status = 'delivered', delivered_at = now()
  where id = p_delivery_id
  returning * into v_delivery;

  return v_delivery;
end;
$$;

grant execute on function public.arrange_delivery(uuid) to authenticated;
grant execute on function public.mark_delivered(uuid) to authenticated;
