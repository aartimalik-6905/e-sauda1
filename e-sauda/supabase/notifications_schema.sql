-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- feature/notifications: a bell icon in the navbar that actually means something.
-- Notifications are created server-side by triggers (not by the client), so a
-- notification always reflects something that really happened in the database --
-- there's no path where the UI could show "New message" without a message existing.

create extension if not exists pgcrypto;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  type text not null check (type in ('message', 'vault_funded', 'vault_completed', 'vault_cancelled')),
  title text not null,
  body text,
  -- Where clicking the notification should take you. Kept as a plain path (e.g.
  -- '/messages?conversation=<id>' or '/vault') instead of separate columns per
  -- notification type, since the set of types is still small and growing.
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
-- Powers the unread-count badge without scanning every row every time.
create index if not exists notifications_unread_idx on public.notifications (user_id) where not read;

alter table public.notifications enable row level security;

-- Notifications are private -- only you can see or update your own.
create policy "Users can view their own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users can mark their own notifications read"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Deliberately no insert policy for ordinary users -- every notification is created by
-- the security-definer trigger functions below, never by a direct client insert. This
-- means a user can never forge a notification (e.g. to make it look like someone
-- messaged them when they didn't).

-- 1. New chat message -> notify whichever party didn't send it.
create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation public.conversations;
  v_recipient uuid;
  v_sender_name text;
begin
  select * into v_conversation from public.conversations where id = new.conversation_id;
  if v_conversation is null then
    return new;
  end if;

  v_recipient := case
    when new.sender_id = v_conversation.buyer_id then v_conversation.seller_id
    else v_conversation.buyer_id
  end;

  select coalesce(display_name, 'Someone') into v_sender_name
  from public.profiles where id = new.sender_id;

  insert into public.notifications (user_id, type, title, body, link)
  values (
    v_recipient,
    'message',
    v_sender_name || ' sent you a message',
    left(new.body, 140),
    '/messages?conversation=' || new.conversation_id
  );

  return new;
end;
$$;

drop trigger if exists on_message_created on public.messages;
create trigger on_message_created
  after insert on public.messages
  for each row execute procedure public.notify_new_message();

-- 2. Vault order status changes -> notify buyer and/or seller depending on what happened.
create or replace function public.notify_vault_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing_title text;
begin
  select title into v_listing_title from public.listings where id = new.listing_id;
  v_listing_title := coalesce(v_listing_title, 'your listing');

  if tg_op = 'INSERT' then
    -- Order just funded: the seller is the one who needs to know funds are secured.
    insert into public.notifications (user_id, type, title, body, link)
    values (
      new.seller_id,
      'vault_funded',
      'Funds secured for ' || v_listing_title,
      'A buyer funded a Vault order. Meet up and confirm the handover OTP to release it.',
      '/vault'
    );
  elsif tg_op = 'UPDATE' and new.status <> old.status then
    if new.status = 'completed' then
      insert into public.notifications (user_id, type, title, body, link)
      values (new.buyer_id, 'vault_completed', 'Handover confirmed for ' || v_listing_title,
              'The sauda is complete. Consider leaving a rating.', '/vault');
      insert into public.notifications (user_id, type, title, body, link)
      values (new.seller_id, 'vault_completed', 'Handover confirmed for ' || v_listing_title,
              'Funds released. Consider leaving a rating.', '/vault');
    elsif new.status = 'cancelled' then
      insert into public.notifications (user_id, type, title, body, link)
      values (new.buyer_id, 'vault_cancelled', 'Vault order cancelled for ' || v_listing_title,
              coalesce(new.cancel_reason, 'The order was cancelled.'), '/vault');
      insert into public.notifications (user_id, type, title, body, link)
      values (new.seller_id, 'vault_cancelled', 'Vault order cancelled for ' || v_listing_title,
              coalesce(new.cancel_reason, 'The order was cancelled.'), '/vault');
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_vault_order_change on public.vault_orders;
create trigger on_vault_order_change
  after insert or update on public.vault_orders
  for each row execute procedure public.notify_vault_status();
