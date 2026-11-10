# feature/notifications — setup guide

What this feature does:

- The 🔔 bell in the navbar (previously a decoration with no behavior) now shows
  a real unread count and a dropdown of your notifications.
- You get notified when: someone sends you a **new chat message**, a buyer
  **funds a Vault order** on your listing, and a Vault order gets **completed
  or cancelled** (both buyer and seller are notified).
- Notifications update live — no refresh needed — via Supabase Realtime, the
  same mechanism the chat feature already uses.
- Clicking a notification marks it read and takes you to the relevant page
  (the conversation, or the Vault page).

## 1. Run the new SQL migration

Supabase dashboard → **SQL Editor** → New query → paste the entire contents of
`supabase/notifications_schema.sql` → **Run**.

This creates the `notifications` table with RLS (you can only ever see or
mark-read your own notifications), plus two triggers:

- `on_message_created` — fires after every insert into `messages`, notifies
  whichever party didn't send it.
- `on_vault_order_change` — fires after insert/update on `vault_orders`,
  notifies the seller when funded, and both parties when completed/cancelled.

Notifications are only ever written by these triggers (there's no insert
policy for ordinary users), so a notification always reflects something that
actually happened — the client can't forge one.

## 2. Enable Realtime on the new table

Supabase dashboard → **Database** → **Replication** → turn on replication for
the `notifications` table (same step you did for `messages` in the chat
feature — if `supabase_realtime` publication already includes `messages`,
just add `notifications` to it).

## 3. Install and run

```bash
npm install
npm run dev
```

## 4. Test it

1. Log in as two different users (two browser windows / one incognito).
2. As user A, message user B on one of B's listings — B's bell should light up
   with a badge, live, without refreshing.
3. Click the notification — it should mark read (badge count drops) and take
   you to that conversation in Messages.
4. As user A, "Buy with Vault" on one of B's listings — B should get a "Funds
   secured" notification.
5. Complete the handover (enter the OTP) — both A and B should get a
   "Handover confirmed" notification.
6. Start another Vault order and cancel it — both parties should get a
   "cancelled" notification with the reason.
7. Click "Mark all read" — the badge should clear and all items should render
   as read (no dot, no highlight).
8. Log out and back in as a different user — confirm you only ever see your
   own notifications, never someone else's (RLS working).

## Design note: why triggers instead of writing notifications from the client

`chat.ts`'s `sendMessage` and `vault.ts`'s RPCs already do the "real" work of
inserting a message or changing an order's status. Writing notifications as a
second client-side call after each of those would mean: (a) two round trips
instead of one, (b) a notification getting silently skipped if the second call
fails or the user's tab closes between the two, and (c) every future place
that sends a message or changes vault status needing to remember to also
notify. A trigger fires atomically in the same transaction, works no matter
which code path caused the change, and can't be bypassed by a client that
doesn't call it.

## Files touched in this branch

- `supabase/notifications_schema.sql` — new: `notifications` table + RLS +
  the two trigger functions.
- `src/types.ts` — added `AppNotification` / `NotificationType`.
- `src/lib/notifications.ts` — new: fetch, mark-read, mark-all-read, realtime
  subscribe.
- `src/lib/time.ts` — new: tiny relative-time formatter for the dropdown.
- `src/hooks/useNotifications.ts` — new: shared hook (fetch once, live
  updates, optimistic mark-read) — same pattern as `useSavedListings.ts`.
- `src/components/Navbar.tsx` — bell button now shows a real unread badge and
  a working dropdown instead of being inert.

Verified in this session: `npm install`, `npx tsc --noEmit`, and `npm run
build` all pass clean with zero errors.
