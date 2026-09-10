-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- feature/meetup-scheduling: lets buyer and seller agree on a date/time/location to
-- meet and complete the handover, instead of only coordinating that through free-text
-- chat messages with nothing structured to look back at.
--
-- Prerequisites: vault_schema.sql and notifications_schema.sql must already be applied.

create table if not exists public.meetups (
  -- One row per Vault order rather than a history table -- there's only ever one
  -- "current" proposed/confirmed meetup at a time; re-proposing overwrites it. Using
  -- vault_order_id as the primary key makes upserting the current state trivial.
  vault_order_id uuid primary key references public.vault_orders on delete cascade,
  proposed_by uuid references auth.users not null,
  meetup_at timestamptz not null,
  location_name text not null,
  -- Nullable: a meetup can be scheduled with just a text description ("Cafe near
  -- Sector 18 metro gate") with no precise coordinates. Coordinates are only needed
  -- to enable the one-tap "Get a ride there" button, not for the meetup itself.
  location_lat double precision,
  location_lng double precision,
  status text not null default 'proposed' check (status in ('proposed', 'confirmed', 'cancelled')),
  updated_at timestamptz not null default now()
);

alter table public.meetups enable row level security;

-- Scoped to the buyer/seller of the referenced order, same pattern as vault_orders
-- itself -- nobody else can see or touch a meetup they're not part of.
drop policy if exists "Buyer and seller can view their meetup" on public.meetups;
create policy "Buyer and seller can view their meetup"
  on public.meetups for select
  using (
    exists (
      select 1 from public.vault_orders v
      where v.id = vault_order_id and (v.buyer_id = auth.uid() or v.seller_id = auth.uid())
    )
  );

drop policy if exists "Buyer and seller can propose or update their meetup" on public.meetups;
create policy "Buyer and seller can propose or update their meetup"
  on public.meetups for insert
  with check (
    proposed_by = auth.uid()
    and exists (
      select 1 from public.vault_orders v
      where v.id = vault_order_id and (v.buyer_id = auth.uid() or v.seller_id = auth.uid())
    )
  );

drop policy if exists "Buyer and seller can change their meetup status" on public.meetups;
create policy "Buyer and seller can change their meetup status"
  on public.meetups for update
  using (
    exists (
      select 1 from public.vault_orders v
      where v.id = vault_order_id and (v.buyer_id = auth.uid() or v.seller_id = auth.uid())
    )
  );

-- Notify whichever party didn't just make the change -- same "notify the other side"
-- pattern as notify_new_message in notifications_schema.sql.
--
-- IMPORTANT: this constraint is shared with price_drop_alerts_schema.sql and
-- report_notify_schema.sql, each of which also drops-and-recreates it. A plain
-- `add constraint` fully replaces the previous list rather than merging with it, so
-- whichever of these three files runs *last* silently wins and narrows it back down
-- to only the types *it* knows about -- if this file runs first and one of the
-- other two runs after it, meetup notifications start failing a check constraint
-- violation (surfaces as a 400 on the meetups insert/update, since the trigger's
-- insert into notifications is part of the same transaction). All three files now
-- declare this same full, canonical list rather than their own partial one, so
-- running them in any order is safe. If you already hit this, also run
-- notifications_type_check_fix.sql once to correct it immediately on your project
-- without needing to re-run all three.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (
  type in (
    'message', 'vault_funded', 'vault_completed', 'vault_cancelled',
    'report_reviewed', 'report_dismissed', 'price_drop',
    'meetup_proposed', 'meetup_confirmed', 'meetup_cancelled'
  )
);

create or replace function public.notify_meetup_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.vault_orders;
  v_recipient uuid;
  v_type text;
  v_title text;
  v_body text;
begin
  select * into v_order from public.vault_orders where id = new.vault_order_id;
  if v_order is null then
    return new;
  end if;

  v_recipient := case
    when new.proposed_by = v_order.buyer_id then v_order.seller_id
    else v_order.buyer_id
  end;

  if tg_op = 'INSERT' then
    -- Always a fresh propose -- there's no prior row to compare against.
    v_type := 'meetup_proposed';
    v_title := 'New meetup time proposed';
    v_body := to_char(new.meetup_at, 'DD Mon, HH12:MI AM') || ' at ' || new.location_name;
  elsif new.status <> old.status then
    if new.status = 'confirmed' then
      v_type := 'meetup_confirmed';
      v_title := 'Meetup confirmed';
      v_body := to_char(new.meetup_at, 'DD Mon, HH12:MI AM') || ' at ' || new.location_name;
    elsif new.status = 'cancelled' then
      v_type := 'meetup_cancelled';
      v_title := 'Meetup cancelled';
      v_body := 'The planned meetup was cancelled.';
    else
      -- e.g. cancelled/confirmed -> proposed again via a fresh upsert.
      v_type := 'meetup_proposed';
      v_title := 'New meetup time proposed';
      v_body := to_char(new.meetup_at, 'DD Mon, HH12:MI AM') || ' at ' || new.location_name;
    end if;
  elsif new.status = 'proposed' and (new.meetup_at <> old.meetup_at or new.location_name <> old.location_name) then
    -- Status didn't change (still 'proposed'), but the actual time/place did -- e.g.
    -- the proposer changed their mind before the other party confirmed. Still worth
    -- notifying; without this branch it would be silently missed since status-only
    -- comparison wouldn't catch it.
    v_type := 'meetup_proposed';
    v_title := 'Meetup time updated';
    v_body := to_char(new.meetup_at, 'DD Mon, HH12:MI AM') || ' at ' || new.location_name;
  else
    -- Nothing notification-worthy changed (e.g. just updated_at bumping with no real
    -- change) -- skip.
    return new;
  end if;

  insert into public.notifications (user_id, type, title, body, link)
  values (v_recipient, v_type, v_title, v_body, '/vault');

  return new;
end;
$$;

drop trigger if exists on_meetup_change on public.meetups;
create trigger on_meetup_change
  after insert or update on public.meetups
  for each row execute procedure public.notify_meetup_change();
