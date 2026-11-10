# feature/moderation-actions-and-blocking — setup guide

Two features bundled together, same as the edit-listing+reports round:

## Part 1: Admin can act on a report

Previously the admin page could only mark a report reviewed/dismissed --
it couldn't actually fix anything. Now:

- **"Remove listing"** button on any report about a listing -- sets it to
  `removed` (soft, not deleted -- chat history and past orders stay intact).
- **"Suspend user"** / **"Lift suspension"** button on any report naming a
  user -- a suspended account can't post new listings or send new messages
  (existing ones stay visible; this isn't a ban-erases-history feature).
- Enforcement is at the **RLS layer**, not just the UI: a suspended user's
  insert on `listings` or `messages` is rejected by Postgres itself, so
  there's no client-side bypass.
- `Sell.tsx` and `Messages.tsx` show a plain "Account suspended" message in
  place of the posting form / send box for a suspended user -- this is just
  UX (avoids showing a form that would fail anyway), the real boundary is
  the RLS policy.

### 1. Run the SQL

Requires `admin_schema.sql` already applied. Then run
`supabase/moderation_actions_schema.sql` in the SQL Editor.

### 2. Test it

1. As an admin, go to `/admin`, open a report naming both a listing and a
   user → click **Remove listing** → confirm it now shows `(removed)` next
   to the title, and visiting that listing's page directly shows it's no
   longer purchasable/active.
2. On the same report, click **Suspend user** → confirm the button flips to
   "Lift suspension".
3. Log in as that suspended account → go to **Sell** → confirm you see
   "Account suspended" instead of the posting wizard.
4. As that account, open **Messages** on an existing thread → confirm you
   see "Your account is suspended and can't send messages" instead of the
   input box.
5. As a non-suspended account, try messaging the suspended user → this
   should still work (only the suspended person's own *sending* is
   blocked, not messages sent *to* them) -- confirms the enforcement is on
   the right side of the conversation.
6. Click **Lift suspension** → confirm that account can post/message again
   immediately.

## Part 2: Block a user from messaging

- **Block / Unblock** button in any chat thread's header.
- Blocking is mutual in effect -- once you block someone, neither of you
  can message the other in that conversation (or start a new one), even
  though only one side did the blocking. This matches how blocking works
  on most platforms.
- A **"Blocked users"** link above your inbox lists everyone you've
  blocked, with a one-click Unblock.
- You can only ever see *who you've* blocked -- RLS means there's no way
  to discover who's blocked you, same privacy reasoning as reports.
- If someone blocks you and you try to message them anyway (e.g. an old
  tab still open), the send is rejected by a database trigger and you see
  "This message couldn't be delivered" -- deliberately vague, it doesn't
  confirm you've been blocked specifically (avoids tipping off the blocked
  person, similar to why reports are reporter-private).

### 1. Run the SQL

Requires `chat_schema.sql` already applied. Then run
`supabase/blocking_schema.sql` in the SQL Editor.

### 2. Test it

1. As user A, open your conversation with user B → click **Block** in the
   thread header → confirm the input box is replaced with "You've blocked
   this user."
2. As user B, try sending a message in that same thread → confirm it
   fails with "This message couldn't be delivered" (not a specific "you've
   been blocked" message).
3. As user A, go to the **Blocked users** panel above your inbox → confirm
   B is listed → click **Unblock** → confirm B can message you again.
4. As user A, block B again, then as B try to start a **brand-new**
   conversation with A (e.g. via a different listing's "Chat with seller")
   → confirm the first message attempt fails the same way (blocking
   applies across all threads between the two, not just the one it was
   set from).

## Design notes

**Why suspension enforcement lives in RLS `with check`, not a trigger.**
Unlike blocking (which needs to look up the conversation's other party
first, awkward to express inline), "is the inserting user suspended" is a
simple boolean check on the same row's implicit actor (`auth.uid()`) --
a straightforward addition to the existing `with check` clause on each
insert policy.

**Why blocking enforcement *is* a trigger.** The opposite reasoning:
determining "who's the other participant in this conversation" requires a
lookup into `conversations` first, which is exactly what a `before insert`
trigger is suited for and a `with check` clause isn't.

**Why both `is_admin()` (existing) and `is_suspended()` /
`is_blocked_between()` (new) are `security definer`.** Same reason each
time: the check needs to read data (another user's `is_admin`/`suspended`
flag, or a block row where *someone else* is the blocker) that the
current user's own RLS wouldn't otherwise let them see directly -- the
function runs with elevated privilege internally but only ever returns a
boolean, so it can't be used to leak the underlying row.

## Files touched in this branch

- `supabase/moderation_actions_schema.sql` — new: `suspended` column,
  `is_suspended()`, admin update policies, suspended-user insert
  enforcement on `listings`/`messages`.
- `supabase/blocking_schema.sql` — new: `blocked_users` table + RLS,
  `is_blocked_between()`, `enforce_not_blocked()` trigger on `messages`.
- `src/context/AuthContext.tsx` — added `suspended` to the `Profile`
  interface/query.
- `src/lib/admin.ts` — added `removeListing()`, `setUserSuspended()`,
  `reportedUserSuspended` tracking.
- `src/pages/Admin.tsx` — added "Remove listing" / "Suspend user" buttons.
- `src/pages/Sell.tsx` — suspended-account notice in place of the wizard.
- `src/lib/blocking.ts` — new: `blockUser()`, `unblockUser()`,
  `fetchMyBlockedUsers()`, `amIBlocking()`.
- `src/pages/Messages.tsx` — Block/Unblock button, blocked-users panel,
  suspended/blocked notices in place of the send form, friendlier error on
  a rejected send.

Verified in this session: `npm install`, `npx tsc --noEmit`, and `npm run
build` all pass clean with zero errors.
