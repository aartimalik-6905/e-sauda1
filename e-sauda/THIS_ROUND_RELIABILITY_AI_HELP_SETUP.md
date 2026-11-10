# This round: performance, reliability, AI descriptions, help guide

## What changed and why

### 1. Lazy loading + a real "slow connection" mode
- Every page is now its own JS chunk (`React.lazy` + `Suspense` in `src/App.tsx`)
  instead of one giant bundle — confirmed by `npm run build`, which now outputs
  ~50 small per-page files instead of one big one.
- New `LazyImage` component (`src/components/LazyImage.tsx`): images only fetch
  once scrolled near, and while **Lite mode** is on they stay as plain grey
  "tap to load" boxes instead of auto-downloading. Nothing about buying,
  selling, chatting, or any other feature depends on images having loaded — the
  site stays fully usable, just visually bare, exactly like the brief asked for.
- Lite mode (`src/hooks/useNetworkStatus.ts` + `src/context/NetworkStatusContext.tsx`)
  turns on automatically on a browser-reported slow/data-saver connection, or
  manually via the new toggle in the **Footer**. It's remembered per-browser.
- Applied to `ListingCard` and `ListingDetail`'s photos; videos on
  `ListingDetail` and `Explore` now use `preload="none"`/`"metadata"` so they
  don't silently download in the background.

Nothing here needs a database change or a secret — it's pure frontend, live as
soon as you deploy the build.

### 2. Help guide button in the footer
New `/help` page (`src/pages/Help.tsx`) — an expandable FAQ covering browsing,
buying via the Vault/escrow flow, selling, chat & offers, saving, reporting,
and Lite mode. Linked from the Footer under "Trust & safety" and in the
copyright line. No setup needed.

### 3. Responsive fix: the navbar had no mobile menu
On a phone, `Browse / Messages / Saved / Vault / Orders` were simply invisible
with zero way to reach them (they were `hidden md:flex` with nothing standing
in for them below `md`), and the search bar could overflow the header. Fixed
in `src/components/Navbar.tsx` with a hamburger + slide-down mobile nav, and
the search bar now wraps to its own row on narrow screens. No setup needed.

### 4. Bug fix: a published listing could go live missing its photos/video
**Root cause:** the Sell wizard used to create the listing row first (making
it immediately live), then upload photos/video and attach them in separate
follow-up calls. If an upload failed partway (dropped connection, closed tab),
the listing stayed active with missing media — including the video, which is
supposed to be mandatory for every listing.

**Fix:** photos/video now upload to storage *before* the listing row is
created, and their URLs are passed straight into `create_listing_with_fee` so
the row is inserted already complete. There's no longer a window where an
active listing exists without the video it was published with. As a bonus,
retrying after a failed upload no longer charges the anti-bot listing fee a
second time.

**You need to run this SQL migration** (adds new parameters to the existing
function with backward-compatible defaults — safe to run, doesn't break
anything else calling it):

```
supabase/create_listing_with_media_schema.sql
```

Run it in Dashboard → SQL Editor → New query, after
`create_listing_with_fee_geolocation.sql` (which should already be applied).

### 5. AI description suggestions from photos/video
On the Sell wizard's Media step, once you've added at least one photo or the
video, a **"✨ Suggest description"** button appears. It grabs up to 2 photos
+ 1 frame from the video (resized client-side, never the full-res files),
sends them to a vision model, and drops a draft description into an editable
textarea right there — review/edit before publishing.

**New Edge Function to deploy:**

```
supabase functions deploy suggest-description
```

**Uses the same `GROQ_API_KEY` secret `chat-assistant` already uses** — no new
key needed if that's already set. Optionally override the vision model via:

```
supabase secrets set GROQ_VISION_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
```

(that's already the default — only set this if Groq deprecates it; check
https://console.groq.com/docs/vision for the current recommended model first).

## Verified
- `npx tsc -b` — clean, no type errors.
- `npx vite build` — succeeds, and the output confirms real code-splitting
  (dozens of small per-page chunks instead of one bundle).
