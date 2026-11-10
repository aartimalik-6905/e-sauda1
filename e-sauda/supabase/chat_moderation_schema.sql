-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- feature/chat-moderation: adds columns for pattern-based scam-signal flags on
-- messages, computed client-side at send time (see src/lib/moderation.ts) and
-- stored so both chat participants see the same warning on that message
-- (not just the sender, who already saw a pre-send warning).
--
-- Prerequisite: supabase/chat_schema.sql must already be applied.

alter table public.messages
  add column if not exists flagged boolean not null default false,
  add column if not exists flag_reasons text[] not null default '{}';

-- Lets the moderation UI (and, later, a real admin review queue) find flagged
-- messages without scanning every row.
create index if not exists messages_flagged_idx on public.messages (flagged) where flagged;
