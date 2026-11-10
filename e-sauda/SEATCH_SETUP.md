# feature/search — setup guide

What this feature does:

- The search box in the navbar (previously decorative — it navigated to
  `/browse?q=...` but Browse ignored the `q` param entirely) now actually
  filters results.
- Browse also gets its own search box in the Filters sidebar, so you can
  refine your search without going back to the navbar.
- Search matches against a listing's **title**, **description**, and
  **sub-category** (case-insensitive, substring match) and combines with
  the existing category/price filters — e.g. category=Electronics + "under
  3k" narrows both at once.
- Typing is debounced (350ms) so it doesn't fire a database query on every
  keystroke, and the query is reflected in the URL so a search is
  bookmarkable/shareable.

## 1. No SQL migration needed

Unlike the last few features, this one needs no schema changes — it queries
the existing `listings.title`, `listings.description`, and
`listings.sub_category` columns directly, so there's nothing to run in
Supabase.

## 2. Install and run

```bash
npm install
npm run dev
```

## 3. Test it

1. From the navbar, type something into the search box (e.g. part of a
   listing title you know exists) and hit Enter — you should land on
   `/browse?q=...` with matching results.
2. On the Browse page itself, use the new search box in the Filters
   sidebar — results should update ~350ms after you stop typing (no need to
   press Enter).
3. Combine search with a category tab and/or a price range — confirm all
   three narrow the results together, not just the last one you touched.
4. Search for something with no matches — confirm you get the "No listings
   match '...' " message instead of a blank grid.
5. Search for a term that appears in a listing's **description** but not its
   title — confirm it still shows up (this is the part that's new; before
   this branch there was no text search at all).
6. Copy the URL while a search is active and open it in a new tab/window —
   confirm the same filtered results load (this checks the URL-sync piece).
7. Clear the search box — confirm it falls back to showing all
   listings/category results again.

## Design note: why `ilike` instead of Postgres full-text search

Postgres full-text search (`tsvector` + a GIN index + `ts_rank` for
relevance ordering) would give better relevance ranking, but it needs a
schema migration (a generated column and an index) and is really earning
its keep at a much larger catalog size than a personal marketplace app is
likely to have any time soon. Plain `ilike` needs zero schema changes,
is "good enough" at this scale, and this branch is easy to swap out for
real full-text search later without changing anything above
`fetchListings()` — Browse and the navbar just call it with a
`{ search: string }` filter either way.

One deliberate detail: user input is escaped before being interpolated into
the `ilike` pattern (`%`/`_` are special characters in SQL `LIKE` patterns),
so searching for something like "100% cotton" behaves as a literal search
rather than `%` being treated as a wildcard.

Also relabeled the navbar's search button from "AI SEARCH" to "SEARCH" —
this branch implements plain substring search, not an AI-ranked search, and
the project's existing convention (see the escrow/verification notes in
`README.md`) is to not oversell what a feature currently does.

## Files touched in this branch

- `src/lib/listings.ts` — added `search` to `ListingFilters`, wired an
  escaped `ilike` match across title/description/sub_category into
  `fetchListings`.
- `src/pages/Browse.tsx` — reads/writes the `q` URL param, added a debounced
  search box to the Filters sidebar, updated the results heading and empty
  state to reflect an active search.
- `src/components/Navbar.tsx` — relabeled "AI SEARCH" → "SEARCH" (no
  functional change — it already linked to `/browse?q=...`, which now
  actually does something).

Verified in this session: `npx tsc --noEmit` and `npm run build` both pass
clean with zero errors.
