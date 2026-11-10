-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- feature/seller-counter-offer: lets the SELLER (not just the buyer) propose a
-- revised price inside an existing chat thread, so real back-and-forth
-- negotiation is possible instead of a one-shot buyer-offer/seller-decision.
--
-- Prerequisite: supabase/chat_offers_schema.sql must already be applied —
-- this alters the table and functions it created.
--
-- Design: chat_offers still only ever has one *pending* row per conversation
-- (same unique index as before). A "counter" is implemented as an atomic
-- decline-old + insert-new pair, run inside a single SECURITY DEFINER
-- function so it can't race against the one-pending-offer constraint and so
-- a client can't fake who actually made the counter (offered_by is derived
-- from auth.uid(), never taken as a parameter).

alter table public.chat_offers
  add column if not exists offered_by text not null default 'buyer'
    check (offered_by in ('buyer', 'seller'));

-- A history pointer: when an offer is superseded by a counter, this points at
-- the new offer row it was replaced by. Lets the chat UI render "Jimmy
-- countered with ₹7,000" as a chain instead of a series of unrelated cards.
alter table public.chat_offers
  add column if not exists superseded_by uuid references public.chat_offers;

-- The very first offer in a conversation is always the buyer's (that's how a
-- negotiation starts — see chat_offers_schema.sql's original insert policy).
-- Counters after that can come from either side, so the insert policy needs
-- to allow the seller too. offered_by/buyer_id/seller_id/listing_id are all
-- still filled in server-side from the conversation, never trusted from the
-- client — same as before, just aware of which side is inserting.
create or replace function public.chat_offers_fill_from_conversation()
returns trigger as $$
declare
  v_conversation record;
begin
  select * into v_conversation from public.conversations where id = new.conversation_id;

  if v_conversation is null then
    raise exception 'Conversation not found';
  end if;
  if auth.uid() <> v_conversation.buyer_id and auth.uid() <> v_conversation.seller_id then
    raise exception 'Only this conversation''s buyer or seller can make an offer';
  end if;

  new.listing_id := v_conversation.listing_id;
  new.buyer_id := v_conversation.buyer_id;
  new.seller_id := v_conversation.seller_id;
  new.offered_by := case when auth.uid() = v_conversation.seller_id then 'seller' else 'buyer' end;
  new.updated_at := now();
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop policy if exists "Buyers can make an offer" on public.chat_offers;
create policy "Buyer or seller can make an offer"
  on public.chat_offers for insert
  with check (auth.uid() = buyer_id or auth.uid() = seller_id);

-- Whoever DIDN'T make the pending offer is the one who can accept/decline it;
-- whoever DID make it can withdraw it. Both directions now possible, unlike
-- the buyer-only version in chat_offers_schema.sql.
drop policy if exists "Buyer can withdraw, seller can accept or decline" on public.chat_offers;
create policy "Either side can respond, whoever made it can withdraw"
  on public.chat_offers for update
  using (
    (auth.uid() = buyer_id or auth.uid() = seller_id)
    and status = 'pending'
  )
  with check (
    (
      ((offered_by = 'buyer' and auth.uid() = buyer_id) or (offered_by = 'seller' and auth.uid() = seller_id))
      and status = 'withdrawn'
    )
    or (
      ((offered_by = 'buyer' and auth.uid() = seller_id) or (offered_by = 'seller' and auth.uid() = buyer_id))
      and status in ('accepted', 'declined')
    )
  );

-- Atomically declines the current pending offer and posts a new one from the
-- other side, so the UI can offer a single "Counter" action instead of
-- "Decline, then separately figure out how to make your own offer" (which the
-- one-pending-offer unique index would otherwise make a two-step, racy dance).
create or replace function public.counter_chat_offer(p_offer_id uuid, p_amount numeric)
returns public.chat_offers as $$
declare
  v_offer record;
  v_new public.chat_offers;
begin
  select * into v_offer from public.chat_offers where id = p_offer_id for update;

  if v_offer is null then
    raise exception 'Offer not found';
  end if;
  if v_offer.status <> 'pending' then
    raise exception 'This offer is no longer pending';
  end if;
  if auth.uid() <> v_offer.buyer_id and auth.uid() <> v_offer.seller_id then
    raise exception 'Not a participant in this negotiation';
  end if;
  -- Only the side that DIDN'T make the current offer can counter it — the
  -- same rule as accept/decline. The offer's own maker should withdraw
  -- instead of "countering" themselves.
  if (v_offer.offered_by = 'buyer' and auth.uid() <> v_offer.seller_id)
     or (v_offer.offered_by = 'seller' and auth.uid() <> v_offer.buyer_id) then
    raise exception 'Only the other party can counter this offer';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Counter amount must be greater than zero';
  end if;

  update public.chat_offers set status = 'declined', updated_at = now() where id = p_offer_id;

  insert into public.chat_offers (conversation_id, buyer_id, amount)
  values (v_offer.conversation_id, v_offer.buyer_id, p_amount)
  returning * into v_new;
  -- offered_by/seller_id/listing_id above are set by the before-insert trigger
  -- from auth.uid() and the conversation row, exactly like a fresh offer.

  update public.chat_offers set superseded_by = v_new.id where id = p_offer_id;

  return v_new;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.counter_chat_offer(uuid, numeric) to authenticated;
