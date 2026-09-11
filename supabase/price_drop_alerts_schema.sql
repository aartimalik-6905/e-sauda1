-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- feature/price-drop-alerts: connects two features that already existed separately --
-- saved items (wishlisting) and notifications -- so saving something is actually
-- useful for more than just a personal bookmark list.
--
-- Prerequisites: supabase/saved_items_schema.sql and supabase/notifications_schema.sql
-- must already be applied.

-- Widen the notifications.type check constraint again, same pattern as
-- report_notify_schema.sql -- one more allowed value.
--
-- IMPORTANT: this constraint is shared with report_notify_schema.sql and
-- meetup_schema.sql, each of which also drops-and-recreates it to add their own
-- types. Since a plain `add constraint` always fully replaces the previous list
-- (not merges with it), whichever of these three files runs *last* silently wins
-- and narrows it back down to only the types *it* knows about -- e.g. running this
-- file after meetup_schema.sql would break every meetup notification with a check
-- constraint violation (visible as a 400 on the meetups insert/update). Fixed by
-- always declaring the full, canonical list of every type used anywhere in the
-- app here, not just the one this feature adds -- so this is safe to (re-)run in
-- any order relative to the other two.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (
  type in (
    'message', 'vault_funded', 'vault_completed', 'vault_cancelled',
    'report_reviewed', 'report_dismissed', 'price_drop',
    'meetup_proposed', 'meetup_confirmed', 'meetup_cancelled'
  )
);

create or replace function public.notify_price_drop()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only a genuine drop, on a still-purchasable listing -- a price increase, or a
  -- price edit on something already sold/removed, isn't useful to announce.
  if tg_op <> 'UPDATE' or new.price >= old.price or new.status <> 'active' then
    return new;
  end if;

  -- One INSERT...SELECT covers everyone who saved this listing, instead of looping --
  -- cheap even if a listing has hundreds of savers, and keeps the trigger simple.
  insert into public.notifications (user_id, type, title, body, link)
  select
    s.user_id,
    'price_drop',
    'Price dropped on a saved item',
    new.title || ' is now Rs ' || new.price || ' (was Rs ' || old.price || ')',
    '/listing/' || new.id
  from public.saved_items s
  where s.listing_id = new.id;

  return new;
end;
$$;

drop trigger if exists on_listing_price_drop on public.listings;
create trigger on_listing_price_drop
  after update on public.listings
  for each row execute procedure public.notify_price_drop();
