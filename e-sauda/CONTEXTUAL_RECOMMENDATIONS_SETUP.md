# feature/contextual-recommendations — setup guide

What this feature does: opening a listing detail page now shows a
**"You might also need"** section below the main listing — other real,
currently-active listings that complement what you're looking at (buying
an AC shows mounting brackets and stabilizers, buying a phone shows cases
and chargers, etc).

This is a static keyword mapping per category, not machine learning — the
same honest-scope approach as smart pricing. It matches against other
listings' title/sub-category using the same `ilike` search already built
for the search bar, so every recommendation is a real, active listing
someone else posted — never a fabricated suggestion.

## 1. No SQL migration needed

Reads from the existing `listings` table only.

## 2. Install and run

```bash
npm install
npm run dev
```

## 3. Test it

1. Post (or find) an active listing in **Appliances** with "AC" or similar
   in the title.
2. Post a second listing in the same category with "mounting bracket" in
   the title or sub-category.
3. Open the first listing's detail page — you should see "You might also
   need" with the second listing shown below the main content.
4. Open a listing in a category with no complementary matches posted yet
   — the section should simply not appear (no empty state, no error).
5. Confirm the ❤️ save button works on a recommended card the same way it
   does everywhere else (it uses the same shared `useSavedListings` hook).
6. Confirm the listing itself never appears in its own recommendations
   (the query explicitly excludes it by id).

## Which categories have a mapping

`Appliances`, `Mobiles`, `Electronics`, `Vehicles`, `Furniture`,
`Fashion`, `Books`, `Sports` — see `src/data/recommendations.ts` for the
exact keyword list per category. Adding a new category's keywords is a
one-line addition to that file, no other code changes needed.

## Files touched in this branch

- `src/lib/listings.ts` — exported `escapeLike` (was private) for reuse.
- `src/data/recommendations.ts` — new: category → complementary-keyword mapping.
- `src/lib/recommendations.ts` — new: `fetchRecommendedListings()`.
- `src/pages/ListingDetail.tsx` — new "You might also need" section, wired
  to the shared saved-listings hook.

Verified in this session: `npm install`, `npx tsc --noEmit`, and
`npm run build` all pass clean with zero errors.
