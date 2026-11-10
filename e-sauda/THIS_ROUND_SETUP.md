# This round's work — setup guide

Four things happened this round. Read the first one first — it's the
most important by far.

---

## 1. CRITICAL FIX: `create_vault_order` had no payment check at all

**What I found:** `supabase/razorpay_schema.sql` existed in your repo but
was literally empty (1 byte) — yet three other files
(`refund_schema.sql`, `listing_fee_schema.sql`, `account_deletion_schema.sql`)
all reference it as an already-applied prerequisite that adds a
`razorpay_payments` table and updates `create_vault_order` to require a
verified payment. That update was never actually written anywhere in
your committed code. The version of `create_vault_order` in
`vault_schema.sql` — which is what your repo would actually apply on a
fresh setup — has **no payment check whatsoever**. It accepts any
listing ID from any logged-in user and creates a real, funded vault
order for free.

**Please check your live Supabase project before assuming this doesn't
affect you** — run this in the SQL Editor:
```sql
select prosrc from pg_proc where proname = 'create_vault_order';
```
If the result does **not** mention `razorpay_payments` anywhere in the
function body, your live database has this exact gap right now — anyone
could currently call `create_vault_order` directly (e.g. via the
Supabase JS client in a browser console) and get a real Vault order with
zero payment. If it **does** already mention `razorpay_payments`, someone
applied the right fix by hand at some point but never saved it to the
repo — this migration will just be a safe, idempotent re-application.

**What I did:** wrote the real `razorpay_schema.sql` — a
`razorpay_payments` table (written only by `verify-razorpay-payment`'s
service-role client, completely inaccessible to any other role) and a
replaced `create_vault_order` that requires a matching, unconsumed,
verified payment before creating an order.

**I tested this against a real local Postgres instance, not just by
reading the code** — the same rigor as the earlier `dispute_fee_schema.sql`
bug. All of these were verified directly:
- Calling `create_vault_order` with **zero payment** → correctly rejected
- Calling it with a **real verified payment** → succeeds, records the
  real `razorpay_payment_id` on the order, marks the listing sold
- The **same payment used twice** (double-spend) → correctly rejected
  the second time
- **A different user** trying to use someone else's verified payment →
  correctly rejected

### Apply it
```bash
# Supabase Dashboard → SQL Editor → paste all of supabase/razorpay_schema.sql → Run
```
No code changes needed on the app side — `create-razorpay-order`,
`verify-razorpay-payment`, and the client already expected this table and
column to exist; they just never had it.

---

## 2. QR code for AR (genuinely free, no quota)

AR itself is camera-based (WebXR on Android Chrome, Quick Look on iOS
Safari) — the "View in AR" button can only ever work **on a phone**.
Someone browsing a listing on a laptop currently has no path to AR at
all. Added a **"Scan to try AR on your phone"** QR code (client-side,
via the `qrcode` package — no API, no account) right below the 3D
preview, linking straight to that listing.

Also fixed a real regression I found while wiring this in: the
`photoUrls` prop on `SpaceFitViewer` (added in the last AR upgrade) had
been **silently dropped** by a later commit that touched the same file —
same "full-file overwrite loses unrelated work" pattern that's bitten
this project before (Navbar losing notification wiring, the vite pin
reverting twice). Restored it.

### Test it
1. Open a listing with dimensions + photos (the AR section should show).
2. Click "On a computer? Scan to try AR on your phone" — a real QR code
   should render.
3. Scan it with an actual phone camera — confirm it opens that exact
   listing.

---

## 3. Open Graph tags (platform-specific — Vercel)

A pure client-side SPA can't give WhatsApp/Facebook a real preview:
those crawlers read `<meta>` tags without running any JavaScript, so
they only ever see whatever's in the raw `index.html` — the same generic
tags regardless of which listing the link is for.

Added:
- **Generic site-wide tags** in `index.html` (covers the homepage and
  any page without its own listing-specific ones) — works everywhere,
  no platform dependency.
- **`api/og-listing.js`** — a Vercel serverless function that fetches a
  specific listing's real title/price/photo and returns proper Open
  Graph tags, for crawlers only.
- **`vercel.json`** — routes requests from known crawler user-agents
  (WhatsApp, facebookexternalhit, Twitterbot, etc.) hitting
  `/listing/:id` to that function; a real person clicking the link is
  redirected straight to the actual page. This file **also fixes a
  separate, likely-existing bug**: without any `vercel.json` at all,
  directly opening a URL like `/listing/abc123` (not navigating there
  from within the app) probably 404s on Vercel today, since there was no
  SPA-fallback rewrite rule. This file adds that too.

**Platform-specific, and I could not test this myself** — I don't have
a live Vercel deployment to hit with a real crawler request. If you're
not on Vercel (Netlify, Cloudflare Pages, etc.), the *concept* carries
over but the exact config file differs — say which platform you're on
and I'll write the equivalent.

### Apply it
1. Deploy with these two new files (`api/og-listing.js`, `vercel.json`)
   in place — Vercel auto-detects the `/api` folder.
2. Confirm `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set as
   **environment variables in your Vercel project settings** (not just
   your local `.env.local` — the serverless function reads them from
   the deployed environment).
3. Test with Facebook's own [Sharing Debugger](https://developers.facebook.com/tools/debug/)
   or WhatsApp's actual link-preview behavior, pasting a real listing URL.

---

## 4. Downloadable PDF receipts

**Vault → history** now has a **"Download receipt"** button on every
completed or cancelled order — entirely client-side (`jspdf`, no
server call). Shows order ID, item, amount, the other party's name,
your role (buyer/seller), dates, and for cancelled orders: refund
amount, any logistics fee deducted, and refund status. Includes the
real Razorpay payment reference when one exists.

### Test it
1. Complete a full buy → handover cycle, go to Vault → history, click
   **Download receipt** — confirm a real PDF downloads with correct details.
2. Do the same for a cancelled order — confirm it shows refund info
   instead of a completion date.

---

## On the AI-driven 360° reconstruction request

Not built, and I want to be upfront about why rather than fake something:
turning a single 2D photo into an accurate 3D model of an arbitrary
object is a genuinely hard computer-vision problem — it needs either a
real photogrammetry pipeline (multiple calibrated photos + heavy
processing) or a paid AI 3D-generation API (Meshy, Kaedim, etc., which
charge per generation). There's no free, client-side way to do this
today. The photo-textured box from the last round is the honest ceiling
for "free."

## On the offer/accept-in-chat feature

Not built this round — deliberately deferred, not forgotten. It's a
substantial, genuinely payment-sensitive feature (a seller accepting a
custom price needs to actually charge that custom amount through
Razorpay, which touches the same payment core I just spent this round
finding and fixing a real hole in). Given how much this round already
covered, I'd rather build that with its own dedicated focus and the same
level of real-database testing, next round, than rush it alongside
everything else.

## Files touched in this round

- `supabase/razorpay_schema.sql` — **rewritten from empty**: `razorpay_payments` table + secured `create_vault_order`.
- `src/components/ArQrCode.tsx` — new: QR code component.
- `src/components/SpaceFitViewer.tsx` — QR code wired in.
- `src/pages/ListingDetail.tsx` — restored the dropped `photoUrls` prop, added `listingId`.
- `src/lib/receipt.ts` — new: `downloadOrderReceipt()`.
- `src/pages/Vault.tsx` — "Download receipt" button.
- `src/lib/listings.ts` — fixed the broken build (`videoUrl` in `mapRow`, added `updateListingVideo`).
- `index.html` — generic site-wide Open Graph tags.
- `api/og-listing.js` — new: Vercel serverless function for per-listing tags.
- `vercel.json` — new: crawler routing + SPA fallback.
- `package.json` — added `qrcode`, `@types/qrcode`, `jspdf`.

Verified in this session: `npm install`, `npx tsc --noEmit`, and
`npm run build` all pass clean. The payment-critical SQL was tested
against a real local Postgres instance across 4 distinct attack/success
scenarios, not just reasoned about.
