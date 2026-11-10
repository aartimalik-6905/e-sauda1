-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run.
--
-- fix/notifications-type-check: THREE separate files -- meetup_schema.sql,
-- price_drop_alerts_schema.sql, and report_notify_schema.sql -- each independently
-- drop-and-recreate the notifications.type check constraint to add their own new
-- type values. A plain `add constraint` fully REPLACES the previous list rather
-- than merging with it, so whichever of the three actually ran last on your
-- project silently narrowed the constraint back down to only the types *that*
-- file knew about.
--
-- Symptom this causes: if price_drop_alerts_schema.sql or report_notify_schema.sql
-- was run after meetup_schema.sql, the constraint no longer allows
-- 'meetup_proposed' / 'meetup_confirmed' / 'meetup_cancelled'. The Vault page's
-- "Propose" button then fails with a 400 -- not because proposing itself is
-- broken, but because the notify_meetup_change() trigger's own
-- `insert into public.notifications (..., type, ...)` call violates the check
-- constraint, which rolls back the entire transaction (the meetups row change
-- included) and PostgREST reports it back as a 400 Bad Request.
--
-- This file is the immediate, one-time fix: it sets the constraint to the full,
-- canonical list of every notification type used anywhere in the app today, no
-- matter what order the three files above were run in. It's also idempotent --
-- safe to run again later, and the three source files have all been updated to
-- declare this same full list themselves, so re-running any of them in the future
-- won't reintroduce this.
--
-- Prerequisite: notifications_schema.sql already applied (this table must exist).

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (
  type in (
    'message', 'vault_funded', 'vault_completed', 'vault_cancelled',
    'report_reviewed', 'report_dismissed', 'price_drop',
    'meetup_proposed', 'meetup_confirmed', 'meetup_cancelled'
  )
);
