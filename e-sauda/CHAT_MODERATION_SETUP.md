# feature/chat-moderation — setup guide

## Note: a regression from an earlier fix

Before building this, I found `npm install` was failing on `main` again —
`package.json`'s `vite` pin had reverted to the broken `^8.1.4` (the fix from
an earlier session didn't survive a later change). Fixed again here.
Verified clean: `npm install`, `npx tsc --noEmit`, `npm run build` all pass.

## What this feature does

Pattern-based scam-signal detection on chat messages — not an ML model,
the same category of heuristic OLX and other marketplaces describe
publicly: phone-number sharing, OTP requests, off-platform payment
pressure, upfront "fee" requests, and external links.

- **Before sending**, if a message matches one of these patterns, the
  sender sees a warning with the specific reason and has to either edit
  the message or explicitly tap "Send anyway" — it's a speed bump, not a
  block.
- **After sending**, a flagged message shows a small caution note
  (visible to both people in the chat) reminding them OTPs and payment
  stay inside the app.
- Detection runs server-side at write time (in `sendMessage()`, not
  trusted from the client), so the flag on a message is never something a
  user could spoof by editing local state.

## 1. Run the new SQL migration

Supabase dashboard → **SQL Editor** → New query → paste the entire
contents of `supabase/chat_moderation_schema.sql` → **Run**.

Adds `flagged` and `flag_reasons` columns to the existing `messages`
table (from `chat_schema.sql`, which must already be applied).

## 2. Fresh install (package.json changed — the vite fix above)

```bash
rm -rf node_modules package-lock.json
npm install
npm run dev
```

## 3. Test it

Try sending each of these in a chat thread and confirm a warning appears
before send, and a caution note appears on the sent message after:
- A phone number: `call me on 98765 43210`
- An OTP request: `please share the otp you got`
- Off-platform payment: `just pay me directly on gpay`
- An upfront fee ask: `I need an advance payment for courier fee first`
- A link: `check this out http://example.com`

Then confirm these do **not** trigger a warning (they're ordinary
marketplace chat that happens to contain numbers or common words):
- `price is 987654 rupees firm, no bargaining`
- `it comes with 2 years warranty and box`
- `I live at flat 402, will be free after 6pm`

Also confirm:
- Typing after a warning appears (to edit the message) dismisses the
  warning automatically.
- Switching to a different conversation clears any pending warning from
  the one you left.
- "Send anyway" actually sends the message and it shows the caution note
  once it appears in the thread.

## Design notes

- **Reasons are categories, not the matched text.** The warning says
  "mentions a phone number" — it doesn't quote back what it matched. This
  keeps the UI from feeling like a surveillance readout and avoids
  training people on exactly how to phrase around it.
- **This nudges, it doesn't block.** Plenty of legitimate reasons exist to
  share a phone number in a P2P marketplace chat (arranging a call, for
  instance) — the goal is making people pause on the OTP/payment/fee
  patterns specifically, not stopping all sharing of contact info.
- **Both parties see the flag**, not just the sender — matches the
  blueprint's "flags these chats instantly" behavior, since a scammer
  won't tap through their own warning, but the flag on their message
  still protects the other person.

## Files touched in this branch

- `supabase/chat_moderation_schema.sql` — new: `flagged`/`flag_reasons` columns + index.
- `src/lib/moderation.ts` — new: `scanMessage()`, `describeFlags()`.
- `src/lib/chat.ts` — `sendMessage()` now computes and stores flags; `mapMessage()` includes them.
- `src/types.ts` — `Message` now has `flagged`/`flagReasons`.
- `src/pages/Messages.tsx` — pre-send warning banner + on-bubble caution note.
- `package.json` — re-fixed the `vite` version regression.

Verified in this session: `npm install`, `npx tsc --noEmit`, `npm run build`
all pass clean. Also ran the regex patterns against 16 realistic
positive/negative test messages (including the 5+5-digit phone grouping
that a first pass of the phone pattern missed) — all pass, no false
positives on ordinary chat.
