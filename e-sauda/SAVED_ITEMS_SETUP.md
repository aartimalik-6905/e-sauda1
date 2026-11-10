# feature/saved-items — setup guide

What this feature does:

- The ❤️ button on any listing card (Browse, Home, Seller profile) now
  actually persists — it was previously local-only UI state that reset on
  refresh.
- A new **Saved** page (`/saved`, linked from the navbar and profile
  dropdown) shows everything you've saved, most recently saved first.
- **Profile → Saved items** now shows your real count instead of a
  hardcoded 0.

## 1. Run the new SQL migration

Supabase dashboard → **SQL Editor** → New query → paste the entire
contents of `supabase/saved_items_schema.sql` → **Run**.

Creates the `saved_items` table with RLS so a wishlist is private — only
its owner can see, add to, or remove from it.

## 2. Install and run

```bash
npm install
npm run dev
```

## 3. Test it

1. On **Browse** or **Home**, tap the ❤️ on a couple of listings — it
   should fill in immediately.
2. Refresh the page — the hearts should still be filled (this is the part
   that was broken before: it used to reset).
3. Go to **Saved** (navbar or profile dropdown) — both listings should
   appear there.
4. Tap the heart on one from the **Saved** page itself — it should
   disappear from that page (this unsaves it for real, not just hides it).
5. Go back to **Browse** — that listing's heart should now be empty again,
   confirming the two views stay in sync.
6. Check **Profile** — "Saved items" should reflect the real count.
7. Open a **seller's public profile** (`/seller/:id`) and save one of
   their listings from there too — confirm it shows up on your `/saved`
   page alongside the others.
8. Log out and back in as a different user — confirm you see an empty
   wishlist, not the previous user's saved items (this is the RLS policy
   working — a wishlist is private per user).

## Design note: why a shared hook instead of each page fetching its own state

`src/hooks/useSavedListings.ts` centralizes the fetch-once/toggle-optimistically
logic that Browse, Home, and SellerProfile all need. Without it, each page
would carry its own copy of the same logic, and saving something on one
page wouldn't be reflected on another until a full refresh. The hook also
does an optimistic update (the heart responds instantly) with rollback if
the database call fails, so a slow connection doesn't make the UI feel
laggy or, worse, lie about what's actually saved.

`ListingCard` itself still works standalone (with local-only, non-persisted
state) if `saved`/`onToggleSaved` props aren't passed — this was a
deliberate choice so it doesn't hard-require the hook everywhere it's used,
in case a future page wants to render a listing card without wishlist
behavior at all.

## Files touched in this branch

- `supabase/saved_items_schema.sql` — new: `saved_items` table + RLS.
- `src/lib/listings.ts` — exported `mapRow` (previously private) so `savedItems.ts` can reuse it.
- `src/lib/savedItems.ts` — new: `fetchSavedListingIds`, `fetchSavedListings`, `saveListing`, `unsaveListing`.
- `src/hooks/useSavedListings.ts` — new: shared hook for saved-state + optimistic toggle.
- `src/components/ListingCard.tsx` — heart button now controllable via props, with local-state fallback.
- `src/pages/Saved.tsx` — new: the wishlist page.
- `src/pages/Browse.tsx`, `src/pages/Home.tsx`, `src/pages/SellerProfile.tsx` — wired to the hook.
- `src/pages/Profile.tsx` — real saved-items count.
- `src/App.tsx` — added protected `/saved` route.
- `src/components/Navbar.tsx` — added a Saved link (navbar + dropdown).

Verified in this session: `npm install`, `npx tsc --noEmit`, and
`npm run build` all pass clean with zero errors. Also re-swept for the
silent-merge-duplication bug pattern from earlier branches — none found.
