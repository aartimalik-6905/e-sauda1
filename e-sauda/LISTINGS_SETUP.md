# feature/listings-db — setup guide

What this branch does: replaces the fake in-memory `listings` array with a
real `listings` table in your Supabase project, so:

- Posting in **Sell** actually creates a row, tied to your logged-in user.
- **Browse** and Home's "Fresh in your city" read real listings (with loading/empty states).
- **Orders → My listings** shows your own listings and lets you remove one.
- **Profile → Active listings** shows your real count.
- The progressive listing cap (2 per category) and the anti-bot fee
  (₹1 → ₹10 → ₹25) are now enforced against real data, per category.

## 1. Create the table

Supabase dashboard → **SQL Editor** → New query → paste in the entire
contents of `supabase/listings_schema.sql` → **Run**.

You should see "Success. No rows returned." This creates the `listings`
table plus row-level security policies:

- Anyone can read `active` listings.
- Only the owner can insert/update/delete their own rows.

## 2. Nothing else to configure

This branch reuses the same `.env.local` (`VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY`) from the auth branch — no new keys needed.

## 3. Install and run

```bash
npm install
npm run dev
```

## 4. Test it

1. Log in (or sign up if you haven't).
2. Go to **Sell**, pick a category, fill in title/price, click through to
   Review, then **Pay ₹1 & publish**.
3. Go to **Browse** — your listing should appear. Try the category tabs and
   price filters.
4. Go to **Home** — it should show up under "Fresh in your city".
5. Go to **Orders → My listings** — you should see it there with a
   **Remove** button. Try removing it — it should disappear from Browse too.
6. Go to **Profile** — "Active listings" should reflect the real count.
7. Post a 2nd and 3rd listing in the *same* category — the fee shown should
   go ₹1 → ₹10 → ₹25, and the 3rd one should be blocked with a "hit your cap"
   message (cap is 2 per category for now).
8. Log out, open **Browse** in an incognito window — listings should still be
   publicly visible (RLS allows public read of active listings), but you
   shouldn't be able to post or delete without logging in.

## What's still mocked / not built yet

- **Photos**: Sell's photo step is still a placeholder (no real upload yet).
  New listings publish with a category icon instead of a photo. That's the
  next branch, `feature/image-upload`.
- **Buying/Selling tabs in Orders**: still empty placeholders — those need
  the escrow/orders table, not this branch.
- **Trust-score-based cap increases**: cap is a flat 2 per category for
  everyone right now; wiring it to `profiles.trust_score` comes later.

## Files touched in this branch

- `supabase/listings_schema.sql` — new: the real `listings` table + RLS.
- `src/types.ts` — `Listing` now matches real DB columns; added `NewListingInput`.
- `src/data/listings.ts` — now only category metadata (mock array/user removed).
- `src/lib/listings.ts` — new: `fetchListings`, `fetchUserListings`,
  `createListing`, `deleteListing`, `markListingSold`,
  `countActiveListingsInCategory`.
- `src/pages/Browse.tsx`, `src/pages/Home.tsx` — fetch real data, loading/empty states.
- `src/pages/Sell.tsx` — publishes real rows, enforces real per-category cap/fee.
- `src/pages/Orders.tsx` — "My listings" tab is real, with delete.
- `src/pages/Profile.tsx` — "Active listings" stat is real.

Verified in this session: `npm install`, `npx tsc --noEmit`, and
`npm run build` all pass clean with zero errors.