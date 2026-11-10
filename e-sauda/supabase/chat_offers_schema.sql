-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- feature/offer-accept: lets a buyer propose a different price inside an
-- existing chat thread; if the seller accepts, that becomes the amount
-- actually charged through Razorpay when the buyer proceeds to Vault.
--
-- Prerequisite: supabase/chat_schema.sql and supabase/razorpay_schema.sql
-- must already be applied (this references both conversations and
-- razorpay_payments).

create extension if not exists pgcrypto;

create table if not exists public.chat_offers (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations on delete cascade not null,
  listing_id uuid references public.listings on delete cascade not null,
  buyer_id uuid references auth.users on delete cascade not null,
  seller_id uuid references auth.users on delete cascade not null,
  amount numeric not null check (amount > 0),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'withdrawn', 'consumed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chat_offers_conversation_idx on public.chat_offers (conversation_id, created_at);
create index if not exists chat_offers_listing_buyer_idx on public.chat_offers (listing_id, buyer_id)
  where status = 'accepted';

-- Only one *open* offer per conversation at a time — a buyer has to wait for
-- the current one to be accepted/declined/withdrawn before sending another,
-- rather than being able to stack up several simultaneous offers.
create unique index if not exists chat_offers_one_pending_per_conversation
  on public.chat_offers (conversation_id)
  where status = 'pending';

alter table public.chat_offers enable row level security;

-- Fills listing_id/seller_id straight from the conversation itself (never
-- trusted from the client) and rejects anyone who isn't that conversation's
-- real buyer from posing as one — same "fill from the real parent row"
-- pattern as vault_orders_fill_from_listing in vault_schema.sql.
create or replace function public.chat_offers_fill_from_conversation()
returns trigger as $$
declare
  v_conversation record;
begin
  select * into v_conversation from public.conversations where id = new.conversation_id;

  if v_conversation is null then
    raise exception 'Conversation not found';
  end if;
  if new.buyer_id <> v_conversation.buyer_id then
    raise exception 'Only this conversation''s buyer can make an offer';
  end if;

  new.listing_id := v_conversation.listing_id;
  new.seller_id := v_conversation.seller_id;
  new.updated_at := now();
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger chat_offers_before_insert
  before insert on public.chat_offers
  for each row execute procedure public.chat_offers_fill_from_conversation();

create or replace function public.chat_offers_touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger chat_offers_before_update
  before update on public.chat_offers
  for each row execute procedure public.chat_offers_touch_updated_at();

create policy "Participants can view offers in their conversations"
  on public.chat_offers for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

create policy "Buyers can make an offer"
  on public.chat_offers for insert
  with check (auth.uid() = buyer_id);

-- Buyers can only withdraw their own still-pending offer; sellers can only
-- accept/decline a still-pending offer. Neither role can ever move a row to
-- 'consumed' through this policy — that value isn't listed as allowed here
-- at all. It's only ever set by verify-razorpay-payment's service-role
-- client, which bypasses RLS entirely, after it has independently confirmed
-- a real payment for that exact amount.
create policy "Buyer can withdraw, seller can accept or decline"
  on public.chat_offers for update
  using (
    (auth.uid() = buyer_id or auth.uid() = seller_id)
    and status = 'pending'
  )
  with check (
    (auth.uid() = buyer_id and status = 'withdrawn')
    or (auth.uid() = seller_id and status in ('accepted', 'declined'))
  );

-- Column-level lock, same reasoning as vault_orders' status-only grant in
-- vault_schema.sql: the RLS policy above already restricts which status
-- transitions are allowed, but without this, a client could still smuggle a
-- changed `amount` into the same update call. Restricting to just the
-- `status` column makes that structurally impossible, not just
-- policy-discouraged.
revoke update on public.chat_offers from authenticated;
grant update (status) on public.chat_offers to authenticated;

-- Traceability: records which offer (if any) a given verified payment
-- actually charged — lets receipts show "you got ₹X off the asking price."
alter table public.razorpay_payments
  add column if not exists offer_id uuid references public.chat_offers;

-- Turns on Supabase Realtime so both buyer and seller see offer/accept/decline
-- state changes live, without a page refresh.
alter publication supabase_realtime add table public.chat_offers;
