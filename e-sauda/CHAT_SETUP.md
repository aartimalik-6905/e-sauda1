# feature/chat-messaging — setup guide

What this branch does:

- Clicking any listing card now opens a real **listing detail page**
  (`/listing/:id`) with a photo gallery, full description, and a
  **"Chat with seller"** button.
- That button starts a real buyer↔seller conversation and takes you to
  **Messages** (`/messages`), a two-pane inbox (conversation list + chat
  thread) with live updates powered by Supabase Realtime — no page refresh
  needed to see a new message arrive.
- A **Messages** link is now in the navbar and the profile dropdown.

## 1. Run the new SQL migration

Supabase dashboard → **SQL Editor** → New query → paste the entire contents
of `supabase/chat_schema.sql` → **Run**.

You should see "Success. No rows returned." This creates:
- `conversations` (one thread per buyer per listing)
- `messages`
- RLS policies so only the two people in a conversation can read/write it
- Turns on **Realtime** for the `messages` table

## 2. Double-check Realtime is actually on

The migration runs `alter publication supabase_realtime add table public.messages;`
which should be enough. If messages don't appear live later, confirm in
Supabase dashboard → **Database → Replication** that `messages` is listed
under the `supabase_realtime` publication with it toggled on.

## 3. Nothing else to configure

Reuses your existing `.env.local` — no new keys.

## 4. Install and run

```bash
npm install
npm run dev
```

## 5. Test it (you'll need two accounts to test both sides)

1. Log in as **User A**, post a listing (or use one from the listings-db test).
2. Log out, sign up as **User B**.
3. As User B, go to **Browse**, click into User A's listing → you land on
   the new detail page. Click **Chat with seller**.
4. You're taken to `/messages/:id` with an empty thread. Send a message.
5. Open a second browser (or incognito window), log in as **User A**, go to
   **Messages** — the conversation should appear in the inbox with User B's
   message as the preview. Click it, and reply.
6. Watch it appear on User B's side **without refreshing** — that's the
   Realtime subscription working.
7. Try visiting `/listing/<your-own-listing-id>` while logged in as its
   owner — you should see "This is your own listing" instead of a chat
   button (can't message yourself).
8. Log out entirely and visit a listing's `/listing/:id` URL directly — the
   page and photos should still show (public), but clicking "Chat with
   seller" should send you to `/login` first.

## What's still mocked / not built yet

- **In-chat scam/OTP detection**: the blueprint's AI moderation (flagging
  phone numbers, "send OTP first", phishing links) isn't wired in — that's
  an AI-features branch, not this one. There's a static safety reminder
  under the message box instead.
- **Read receipts / unread badges**: not implemented — the Messages nav
  link doesn't show an unread count yet.
- **Escrow handoff inside chat**: the "Funds Secured in Vault" status sync
  described in the blueprint belongs to `feature/escrow`, which comes next.

## Files touched in this branch

- `supabase/chat_schema.sql` — new: `conversations` + `messages` tables, RLS, Realtime.
- `src/types.ts` — added `Conversation`, `Message`, `ConversationSummary`.
- `src/lib/listings.ts` — added `fetchListingById`.
- `src/lib/chat.ts` — new: `getOrCreateConversation`, `fetchConversations`,
  `fetchConversationById`, `fetchMessages`, `sendMessage`, `subscribeToMessages`.
- `src/pages/ListingDetail.tsx` — new: full listing view + chat entry point.
- `src/pages/Messages.tsx` — new: inbox + realtime chat window.
- `src/components/ListingCard.tsx` — now links to `/listing/:id`.
- `src/App.tsx` — added `/listing/:id`, `/messages`, `/messages/:id` routes.
- `src/components/Navbar.tsx` — added a Messages link (navbar + dropdown).

Verified in this session: `npm install`, `npx tsc --noEmit`, and
`npm run build` all pass clean with zero errors.
