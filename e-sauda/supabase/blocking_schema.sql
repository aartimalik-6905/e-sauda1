-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- feature/blocking: lets a user block someone from messaging them, without needing to
-- file a report and wait for an admin. Blocking is mutual in effect (once blocked,
-- neither person can message the other) even though only one side "did" the blocking --
-- this matches how blocking works on most platforms and avoids a confusing state where
-- the blocked person can still message the blocker but not vice versa.
--
-- Prerequisite: supabase/chat_schema.sql must already be applied.

create table if not exists public.blocked_users (
  blocker_id uuid references auth.users on delete cascade not null,
  blocked_id uuid references auth.users on delete cascade not null,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocked_users_not_self check (blocker_id <> blocked_id)
);

alter table public.blocked_users enable row level security;

-- You can only see/manage your own block list -- not who's blocked you (that's the
-- other person's private decision, same reasoning as reports being reporter-private).
create policy "Users can view their own block list"
  on public.blocked_users for select
  using (auth.uid() = blocker_id);

create policy "Users can block people"
  on public.blocked_users for insert
  with check (auth.uid() = blocker_id);

create policy "Users can unblock people"
  on public.blocked_users for delete
  using (auth.uid() = blocker_id);

-- Security definer so it can check "did either of these two block the other" regardless
-- of whose RLS context is asking -- a sender needs to know if the *recipient* blocked
-- them, which the sender's own row-level access to blocked_users wouldn't otherwise see.
create or replace function public.is_blocked_between(user_a uuid, user_b uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.blocked_users
    where (blocker_id = user_a and blocked_id = user_b)
       or (blocker_id = user_b and blocked_id = user_a)
  );
$$;

-- Enforcement: reject a new message if either participant has blocked the other.
-- A trigger (not a WITH CHECK clause) because this needs to look up the conversation's
-- other participant first -- straightforward in a trigger, awkward to express inline.
create or replace function public.enforce_not_blocked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation public.conversations;
  v_other_party uuid;
begin
  select * into v_conversation from public.conversations where id = new.conversation_id;
  if v_conversation is null then
    return new;
  end if;

  v_other_party := case
    when new.sender_id = v_conversation.buyer_id then v_conversation.seller_id
    else v_conversation.buyer_id
  end;

  if public.is_blocked_between(new.sender_id, v_other_party) then
    raise exception 'Cannot send message: blocked' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists on_message_check_blocked on public.messages;
create trigger on_message_check_blocked
  before insert on public.messages
  for each row execute procedure public.enforce_not_blocked();
