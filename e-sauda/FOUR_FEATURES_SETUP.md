# This round: 4 features

Negotiation pricing, mobile OTP signup, sharper recommendations, and a
grounded chatbot assistant. UI redesign was explicitly skipped per your ask.

## 1. Negotiation pricing (offer/accept-in-chat)

Buyer proposes a price inside an existing chat thread; seller accepts or
declines right there. If accepted, **that** amount — not the listing's
asking price — is what Razorpay actually charges when the buyer proceeds to
Vault. Re-derived independently, server-side, in both `create-razorpay-order`
and `verify-razorpay-payment` — never trusted from the client.

Run: `supabase/chat_offers_schema.sql` (needs `chat_schema.sql` and
`razorpay_schema.sql` already applied).

Redeploy the two edge functions (they changed):
```bash
supabase functions deploy create-razorpay-order
supabase functions deploy verify-razorpay-payment
```

Test: open a chat as the buyer → "Make offer" box above the message input →
seller (other account) sees Accept/Decline on the offer card → once
accepted, go to that listing as the buyer — a green banner shows the
discounted price, and the "Buy with Vault" button shows it too. Complete
checkout and confirm the Razorpay amount matches, not the original price.

## 2. Mandatory mobile number + OTP verification

Signup now requires a 10-digit mobile number. After email confirmation and
first login, you're redirected to `/verify-phone` (can't reach any other
page until it's done) where a 6-digit code is checked before you're let
through.

Run: `supabase/phone_otp_schema.sql`.

Deploy the two new functions:
```bash
supabase functions deploy send-phone-otp
supabase functions deploy verify-phone-otp
```

**Mocked: no real SMS provider is wired up yet.** Without an `SMS_API_KEY`
secret set, `send-phone-otp` returns the code directly in its response (shown
on the `/verify-phone` page in an amber box) so you can test the whole flow
without a live SMS gateway. Before real users sign up, either:
- Set `SMS_API_KEY` to a real provider's key and adjust the `fetch` call in
  `supabase/functions/send-phone-otp/index.ts` to match that provider's
  actual request shape (it's currently written generically for something
  MSG91-like — Twilio, Fast2SMS etc. all differ slightly), **or**
- At minimum, delete the `debugOtp` fallback in that file so codes are never
  exposed in an API response.

## 3. Sharper recommendations

The existing complementary-item system (category → keywords) now also
checks the listing's own title/sub-category text against a second, more
specific layer first — e.g. "scooty"/"scooter" surfaces a scooter cover and
cleaner specifically, not just the generic Vehicles list; "shirt" surfaces
trousers/belt/shoes/buttons. Falls back to the category-level list when
nothing specific matches. Both layers are just data — see
`src/data/recommendations.ts` — add more `matches`/`keywords` entries there
any time without touching the fetch logic itself.

No SQL, no redeploy needed — this is pure front-end logic.

## 4. Chatbot assistant (real, not mocked)

Floating widget, bottom-right, visible on every page once logged in — for
either a buyer ("what's the status of my order", "what did I pay") or a
seller ("what am I selling", "what should I list next"). This is a genuine
Anthropic API integration, not a scripted bot: every message re-fetches
*this specific user's* real listings, purchases, and sales server-side and
folds a summary into the system prompt, so it answers from your actual
database rather than making things up.

Requires an Anthropic API key:
```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy chat-assistant
```

Test: log in, click the chat bubble bottom-right, ask "what have I listed"
or "what's the status of my orders" — the answer should match your actual
data exactly, not be generic.

## Files touched this round

- `supabase/chat_offers_schema.sql` — new
- `supabase/functions/create-razorpay-order/index.ts`,
  `supabase/functions/verify-razorpay-payment/index.ts` — modified
- `src/lib/chatOffers.ts` — new
- `src/types.ts` — added `ChatOffer`
- `src/pages/Messages.tsx`, `src/pages/ListingDetail.tsx` — offer UI
- `supabase/phone_otp_schema.sql` — new
- `supabase/functions/send-phone-otp/index.ts`,
  `supabase/functions/verify-phone-otp/index.ts` — new
- `src/lib/phoneAuth.ts` — new
- `src/pages/Signup.tsx`, `src/pages/VerifyPhone.tsx` (new),
  `src/components/RequireAuth.tsx`, `src/context/AuthContext.tsx` — modified
- `src/data/recommendations.ts`, `src/lib/recommendations.ts` — modified
- `supabase/functions/chat-assistant/index.ts` — new
- `src/lib/chatbot.ts`, `src/components/ChatbotWidget.tsx` — new
- `src/App.tsx` — new routes + widget mount

Verified in this session: `npx tsc --noEmit` and `npm run build` both pass
clean with zero errors.

## What's still mocked or not built

- SMS sending (see section 2 above) — code delivery itself is mocked, the
  verification logic around it is real.
- The chatbot has no memory across page reloads — each session starts
  fresh (no chat history persisted to the database).
- No UI/visual redesign this round, per your instruction to skip it.
