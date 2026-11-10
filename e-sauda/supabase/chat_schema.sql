-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Adds real-time buyer/seller chat, tied to a specific listing.
--
-- Prerequisite: supabase/listings_schema.sql must already be applied
-- (conversations reference the listings table).

create extension if not exists pgcrypto;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings on delete cascade not null,
  buyer_id uuid references auth.users on delete cascade not null,
  seller_id uuid references auth.users on delete cascade not null,
  created_at timestamptz not null default now(),
  -- One thread per buyer per listing — reopening chat on the same item
  -- resumes the existing conversation instead of creating a duplicate.
  unique (listing_id, buyer_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations on delete cascade not null,
  sender_id uuid references auth.users on delete cascade not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at);
create index if not exists conversations_buyer_idx on public.conversations (buyer_id);
create index if not exists conversations_seller_idx on public.conversations (seller_id);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Only the two people in a conversation can see it or send/read messages in it.
create policy "Participants can view their conversations"
  on public.conversations for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

create policy "Buyers can start a conversation"
  on public.conversations for insert
  with check (auth.uid() = buyer_id and buyer_id <> seller_id);

create policy "Participants can view messages in their conversations"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  );

create policy "Participants can send messages in their conversations"
  on public.messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  );

-- Turns on Supabase Realtime for the messages table so the chat window
-- updates instantly for both people without a page refresh.
alter publication supabase_realtime add table public.messages;
