-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- feature/report-notify: closes the loop between the reports and notifications
-- systems -- previously a reporter had no way to know their report was ever looked
-- at. Fires once, the first time a report leaves 'open' (reviewed or dismissed).
--
-- Prerequisites: supabase/reports_schema.sql and supabase/notifications_schema.sql
-- must already be applied.

-- The notifications table's `type` column has a fixed check constraint listing every
-- allowed value -- widen it to include the two new types this feature adds. Default
-- constraint naming for an inline column check is '<table>_<column>_check'.
--
-- IMPORTANT: this constraint is shared with price_drop_alerts_schema.sql and
-- meetup_schema.sql, each of which also drops-and-recreates it to add their own
-- types. A plain `add constraint` fully replaces the previous list rather than
-- merging with it, so whichever of these three files runs *last* silently wins and
-- narrows it back down to only the types *it* knows about -- e.g. running this file
-- after meetup_schema.sql would break every meetup notification with a check
-- constraint violation (visible as a 400 on the meetups insert/update). Fixed by
-- always declaring the full, canonical list of every type used anywhere in the app
-- here, not just the two this feature adds -- so this is safe to (re-)run in any
-- order relative to the other two.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (
  type in (
    'message', 'vault_funded', 'vault_completed', 'vault_cancelled',
    'report_reviewed', 'report_dismissed', 'price_drop',
    'meetup_proposed', 'meetup_confirmed', 'meetup_cancelled'
  )
);

create or replace function public.notify_report_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link text;
begin
  -- Only fire the *first* time a report leaves 'open' -- if an admin somehow toggles
  -- it back and forth, the reporter doesn't need a notification for every flip.
  if tg_op <> 'UPDATE' or old.status <> 'open' or new.status = 'open' then
    return new;
  end if;

  -- Point at whatever's most relevant: the listing if this report named one,
  -- otherwise the reported user's profile, otherwise nowhere in particular.
  if new.listing_id is not null then
    v_link := '/listing/' || new.listing_id;
  elsif new.reported_user_id is not null then
    v_link := '/seller/' || new.reported_user_id;
  else
    v_link := null;
  end if;

  if new.status = 'reviewed' then
    insert into public.notifications (user_id, type, title, body, link)
    values (
      new.reporter_id,
      'report_reviewed',
      'Your report was reviewed',
      'Thanks for flagging this -- a moderator has looked into it.',
      v_link
    );
  elsif new.status = 'dismissed' then
    insert into public.notifications (user_id, type, title, body, link)
    values (
      new.reporter_id,
      'report_dismissed',
      'Your report was reviewed',
      'A moderator looked into this and didn''t find a violation.',
      v_link
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_report_status_change on public.reports;
create trigger on_report_status_change
  after update on public.reports
  for each row execute procedure public.notify_report_status();
