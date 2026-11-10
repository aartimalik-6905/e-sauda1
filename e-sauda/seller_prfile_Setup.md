# feature/seller-profile — setup steps

Public seller profile page at `/seller/:id` — trust score, real rating average, active
listings, and review history. No new database schema needed; this branch is pure
client-side wiring on top of the `profiles` and `ratings` tables that already exist.

## 1. Make the branch

```bash
git checkout main
git pull origin main
git checkout -b feature/seller-profile
```

## 2. Copy these files over (overwrite where they exist)

New:
- `src/lib/profiles.ts`
- `src/pages/SellerProfile.tsx`

Changed:
- `src/App.tsx` — added `/seller/:id` route
- `src/pages/ListingDetail.tsx` — added a "View seller profile" link (hidden for your
  own listings)

## 3. No SQL to run

This branch only reads data that already exists — `profiles` (trust score, rating
columns from the ratings branch) and the `ratings` table's `fetchRatingsForUser`
function, which was already built but unused until now.

## 4. Install and run

```bash
npm install
npm run dev
```

## 5. Test it

1. Open any listing that isn't your own → click **View seller profile**.
2. Confirm you see: display name, city, join date, verified badge (if applicable),
   trust score, and rating average (if they have any completed, rated orders).
3. Confirm their active listings show up in a grid below.
4. If they have any ratings (from the ratings branch's flow), confirm the review list
   shows stars + comment + date.
5. Try visiting `/seller/<some-random-uuid>` directly — confirm you get a clean "Seller
   not found" page, not a crash.

## 6. Commit, push, merge

```bash
git add -A
git commit -m "Add public seller profile page"
git push -u origin feature/seller-profile
git checkout main
git merge feature/seller-profile
git push origin main
```

## Next feature

`feature/delivery` — the Rapido/Uber/Dunzo-style mock logistics flow from the original
spec, triggered once a Vault handover is confirmed.
