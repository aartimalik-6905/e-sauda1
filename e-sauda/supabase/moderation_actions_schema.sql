-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- feature/moderation-actions: lets an admin actually DO something about a report --
-- remove the listing, or suspend the account -- instead of only marking it reviewed.
--
-- Requires supabase/admin_schema.sql to already be applied (uses public.is_admin()).

-- 1. The suspension flag itself.
alter table public.profiles add column if not exists suspended boolean not null default false;

-- Small helper, same reasoning as is_admin() in admin_schema.sql: one place that
-- defines "is this user currently suspended", security definer so it can check
-- regardless of whose RLS context is asking.
create or replace function public.is_suspended(check_user_id uuid default auth.uid())
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select suspended from public.profiles where id = check_user_id), false);
$$;

-- 2. Let admins flip is_admin/suspended and other profile fields when needed (e.g.
-- correcting a display name during a report review). Ordinary users still only see
-- their own profile via the existing "Users can update their own profile" policy --
-- this is an additional, admin-only path, not a replacement for it.
create policy "Admins can update any profile"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- 3. Let admins update any listing's status (e.g. set it to 'removed'), not just their
-- own. Pairs with the "Admins can view all listings" select policy from admin_schema.sql.
create policy "Admins can update any listing"
  on public.listings for update
  using (public.is_admin())
  with check (public.is_admin());

-- 4. Enforcement: a suspended user can't post new listings or send new messages.
-- Existing rows aren't touched (their past listings/messages stay visible -- this
-- isn't a ban-erases-history feature), it just stops new activity.
--
-- Both policies below replace the originals from listings_schema.sql / chat_schema.sql
-- with a version that adds "and not is_suspended()" to the same with check clause.
-- (chat_moderation_schema.sql's flagged/flag_reasons columns are untouched by this --
-- this only changes who's allowed to insert a row, not the row's shape.)

drop policy if exists "Users can insert their own listings" on public.listings;
create policy "Users can insert their own listings"
  on public.listings for insert
  with check (auth.uid() = owner_id and not public.is_suspended());

drop policy if exists "Participants can send messages in their conversations" on public.messages;
create policy "Participants can send messages in their conversations"
  on public.messages for insert
  with check (
    auth.uid() = sender_id
    and not public.is_suspended()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  );
