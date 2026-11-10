# feature/ratings — setup guide

## Important: this branch also fixes a broken `main`

Before building this feature, I checked your repo and found `main` was
actually broken — a previous merge of `feature/escrow-vault` into `main`
was committed with **raw, unresolved conflict markers still in the code**
(literal `<<<<<<< HEAD` text in `src/lib/chat.ts`, `src/types.ts`,
`src/pages/ListingDetail.tsx`, `src/pages/Messages.tsx`), plus two silent
duplicate-code bugs from an earlier auto-merge (`fetchListingById` defined
twice, and the `/listing/:id` + `/messages` routes each registered twice).
`package.json` also had `vite` pinned to `^8.1.4`, which conflicts with
your current `@vitejs/plugin-react` and breaks `npm install` on a clean
machine.

**All of that is fixed in this branch.** It was built directly on top of
the repair, so applying this branch's files fixes `main` and adds ratings
in one step. Verified clean in this session: `npm install`,
`npx tsc --noEmit`, and `npm run build` all pass with zero errors.

## What this feature does

- After a Vault order is marked **Completed**, either party can rate the
  other: 1–5 stars + an optional comment, from **Vault → history**.
- Ratings feed `profiles.trust_score` for real now (previously a static 50
  for everyone) — each rating nudges it by ±2 to ±4 points, capped at
  0–100, computed atomically in the database.
- **Profile** now shows your real average rating and rating count next to
  the trust score, a real "Completed saudas" count, and badge unlock
  conditions (`First sauda`, `5-star seller`) now check real data instead
  of always being locked.

## 1. Run the new SQL migration

Supabase dashboard → **SQL Editor** → New query → paste the entire
contents of `supabase/ratings_schema.sql` → **Run**.

This adds `rating_avg` / `rating_count` columns to `profiles`, creates the
`ratings` table with RLS, and a `submit_rating()` function (same
SECURITY DEFINER pattern as `vault_schema.sql` — it verifies the order is
real, completed, and that the caller was actually part of it, entirely
inside the database, not trusted from the client).

## 2. Fresh install (package.json changed as part of the main repair)

```bash
rm -rf node_modules package-lock.json
npm install
npm run dev
```

## 3. Test it (you'll need a completed Vault order — see ESCROW_VAULT_SETUP.md)

1. Complete a full buy → OTP handover cycle between two accounts, so a
   Vault order reaches `Completed` status.
2. As either party, go to **Vault**, find that order under "Past orders",
   and click **Rate this transaction**.
3. Pick 1–5 stars, optionally add a comment, submit.
4. The row should now show "You rated this transaction ★★★★★" instead of
   the form.
5. Log in as the *other* party in that transaction, go to **Profile** —
   their trust score should have moved (up for 4–5 stars, down for 1–2,
   unchanged for 3), and you should see the real rating average/count.
6. Try rating the same order twice — the second attempt should fail
   (enforced by the `unique (vault_order_id, rater_id)` constraint).
7. Try calling `submit_rating` for an order you weren't part of, or one
   that isn't completed yet — both should be rejected server-side.

## What's still not built

- **No public seller-profile page yet.** Ratings are stored and readable
  (RLS allows public select), and `fetchRatingsForUser()` is ready to use,
  but there's no `/seller/:id` route to show someone else's reviews to a
  buyer before they purchase. That's a natural next branch.
- **No written-review display** — comments are stored but not shown
  anywhere yet, only the star average.

## Files touched in this branch

**Main repair (see note above):**
- `src/lib/chat.ts`, `src/types.ts`, `src/pages/ListingDetail.tsx`,
  `src/pages/Messages.tsx` — removed literal conflict-marker text.
- `src/lib/listings.ts` — removed a duplicated `fetchListingById`.
- `src/App.tsx` — removed duplicated routes.
- `package.json` — `vite` pinned to `^5.4.0` instead of `^8.1.4`.

**Ratings feature:**
- `supabase/ratings_schema.sql` — new: `ratings` table, RLS, `submit_rating()`.
- `src/types.ts` — added `Rating`.
- `src/lib/ratings.ts` — new: `submitRating`, `fetchMyRatingForOrder`, `fetchRatingsForUser`.
- `src/context/AuthContext.tsx` — profile now includes `rating_avg`/`rating_count`.
- `src/pages/Vault.tsx` — completed-order rows now have a star-rating flow.
- `src/pages/Profile.tsx` — real rating average, real completed-saudas count, real badge conditions.
