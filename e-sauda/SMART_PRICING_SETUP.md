# feature/smart-pricing — setup guide

What this feature does: while posting in **Sell → Details**, once you've
picked a category (and optionally typed a sub-category), the price field
shows a real suggested range pulled from other active listings on the
platform — e.g. "Similar Mobiles listings go for ₹8,000–₹22,000 (14 active
listings)" with a **Use ₹median** button that fills the price field.

No computer vision involved (that needs a paid image-model API — see the
blocked-features list) — this is a straightforward aggregate query:
matching listings' prices, sorted, giving low/median/high.

## How the range is chosen

- Tries **sub-category first** (e.g. "iPhone" within "Mobiles") if you've
  typed one and there are at least 3 active listings matching it — a more
  specific range is more useful than a category-wide one.
- Falls back to the **whole category** if the sub-category doesn't have
  enough listings yet, or if you haven't typed one.
- Shows nothing (with an honest "not enough similar listings yet" message)
  if even the whole category has fewer than 3 active listings — a
  two-listing sample isn't a real market signal, and a fabricated-looking
  range would be worse than no suggestion.
- The range is **min–max** of the matching sample, and the "Use" button
  fills in the **median**. With very small samples (3–5 listings) min/max
  can be pulled around by one outlier lister — this is a known simplification,
  not a statistically robust interquartile range. Worth revisiting once the
  platform has enough volume for that to matter.

## 1. No SQL migration needed

This feature only reads from the existing `listings` table — no schema
change.

## 2. Install and run

```bash
npm install
npm run dev
```

## 3. Test it

1. Go to **Sell**, pick a category with several existing active listings
   (e.g. Mobiles, if you've posted test listings there before).
2. In the Details step, you should see a suggested range appear under the
   price field within about half a second.
3. Type a sub-category that matches an existing listing's sub-category —
   the range should narrow and the note should say it's sub-category
   specific.
4. Type a sub-category that has no matches — the range should fall back
   to the whole category.
5. Click **Use ₹[median]** — the price field should fill in with that
   number.
6. Try a category with fewer than 3 active listings (or a brand new
   category with none) — you should see "Not enough similar listings yet
   to suggest a price range" instead of a misleading number.
7. Type quickly in the sub-category field — the query should wait for you
   to pause (400ms debounce) rather than firing on every keystroke.

## Files touched in this branch

- `src/lib/pricing.ts` — new: `suggestPrice()`.
- `src/pages/Sell.tsx` — Details step now shows the real suggestion
  (replacing the old placeholder text that said it would appear "once you
  add photos").

Verified in this session: `npm install`, `npx tsc --noEmit`, and
`npm run build` all pass clean with zero errors.
