# feature/mark-as-sold — setup guide

## Note on how I found this one

Instead of proposing a new feature this round, I found a real gap by
reading the actual code: `markListingSold()` already existed in
`src/lib/listings.ts` — but nothing in the UI ever called it. A seller who
sold something outside the Vault flow (in-person cash, for instance —
common on a P2P marketplace) had no way to take their listing down. It
would just sit on Browse forever looking available. This finishes that
already-half-built function instead of leaving it dead code.

## What this feature does

On **My Listings**, active listings now have a **"Mark as sold"** button
next to Edit/Delete. Sold listings get a **"Relist"** button to undo a
mistaken click and put them back in front of buyers — without re-posting
from scratch, which would lose the listing's chat history and saved-item
counts.

No SQL migration needed — the RLS policy that lets owners update their
own listings already covers a status change, same as it already did for
edits.

## Design tradeoff worth knowing

"Relist" doesn't distinguish between a listing marked sold by this new
button versus one marked sold through a **real completed Vault
transaction**. A seller could technically relist something that actually
sold and was paid for through the app. This is a deliberate scope
simplification, not an oversight — distinguishing the two would need
joining against `vault_orders` per listing. Given it's the seller's own
listing and their own call to make, this felt like reasonable scope for
now; flagging it here in case you want tighter guardrails later (e.g.
only offering Relist when there's no completed Vault order tied to that
listing).

## 1. Install and run

```bash
npm install
npm run dev
```

## 2. Test it

1. Go to **My Listings**, find an active listing, click **Mark as sold**.
2. Confirm its status badge changes to "sold" and the Edit/Mark-as-sold
   buttons are replaced by a **Relist** button.
3. Confirm that listing no longer appears on **Browse** or Home's "Fresh
   in your city" (both only show `active` listings).
4. Click **Relist** — confirm it goes back to "active" and reappears on
   Browse.
5. Confirm **Delete** still works from either state.

## Files touched in this branch

- `src/lib/listings.ts` — added `relistListing()` alongside the existing (now finally used) `markListingSold()`.
- `src/pages/MyListings.tsx` — Mark as sold / Relist buttons.

Verified in this session: `npm install`, `npx tsc --noEmit`, and
`npm run build` all pass clean with zero errors.
