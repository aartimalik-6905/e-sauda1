# feature/edit-listing-and-reports — setup guide

Two small, independent features bundled into one branch since neither needed
its own follow-up work to be useful on its own.

## Part 1: Edit listing

What it does:

- Your own listing detail page now has an **"Edit listing"** button.
- Takes you to `/listing/:id/edit`, a small form for title, price, condition,
  city, and description.
- **Category is intentionally not editable** — it drives the per-category
  listing cap and anti-bot fee tier (`countActiveListingsInCategory` in
  `lib/listings.ts`), so letting someone silently switch category after
  posting would be a way to dodge that. If a listing is in the wrong
  category, delete and repost it.
- Protected two ways: the page itself checks `ownerId === user.id` and shows
  a "Not your listing" page if not, and the existing RLS policy on
  `listings` ("Users can update their own listings") would reject the
  database write either way even if someone bypassed the UI.

No SQL migration needed — it uses the `listings` table and RLS policy that
already exist.

### Test it

1. Go to one of your own listings → click "Edit listing".
2. Change the title and price → Save → confirm you're taken back to the
   listing and it shows the new values.
3. Try submitting an empty title, or a negative/blank price → confirm you
   get a validation error instead of it silently failing or saving garbage.
4. Try navigating directly to `/listing/<someone-else's-listing-id>/edit` →
   confirm you get "Not your listing", not their listing's edit form.
5. Confirm the category shown at the top of the edit form matches the
   listing and there's no way to change it from this page.

## Part 2: Report a listing or user

What it does:

- **"Report listing"** button on any listing detail page (not shown on your
  own listings).
- **"Report user"** button on any seller's public profile (not shown on your
  own profile).
- Both open the same small modal: pick a reason (scam/fraud, prohibited
  item, misleading listing, harassment, spam, other) and optionally add
  details, then submit.
- Reports are private — RLS means a reporter can only ever see their own
  filed reports, never anyone else's, and there's no way for the reported
  person to find out who reported them.
- There's no admin review UI yet (that's a natural next feature once you
  have enough report volume to justify one) — for now, review reports
  directly in the Supabase dashboard's Table Editor, filtering by
  `status = 'open'`.

### 1. Run the new SQL migration

Supabase dashboard → SQL Editor → New query → paste the entire contents of
`supabase/reports_schema.sql` → Run.

This creates the `reports` table with RLS: users can insert reports as
themselves and view only their own; there's deliberately no update/delete
policy for ordinary users, so a filed report can't be edited or deleted
after the fact from the client (only a service-role key, e.g. from a future
admin tool, could change its `status`).

### 2. Test it

1. As a buyer, open someone else's listing → "Report listing" → pick a
   reason → submit → confirm you see the "we've received your report"
   confirmation.
2. Open that same seller's profile page → confirm "Report user" is there
   too, and works the same way.
3. Open your **own** listing and your **own** profile → confirm neither
   shows a Report button (you can't report yourself).
4. Try clicking Report while logged out → confirm it sends you to `/login`
   instead of opening the modal.
5. In the Supabase Table Editor, open the `reports` table → confirm your
   test reports show up with the right `reporter_id`, `listing_id` /
   `reported_user_id`, and `reason`.
6. Log in as a *different* account and try querying the `reports` table
   from the browser console (`supabase.from('reports').select('*')`) →
   confirm you only ever get back reports *you* filed, never the other
   account's.

## Files touched in this branch

- `supabase/reports_schema.sql` — new: `reports` table + RLS.
- `src/lib/listings.ts` — added `updateListing()` + `ListingUpdateInput`.
- `src/lib/reports.ts` — new: `submitReport()`, reason labels.
- `src/pages/EditListing.tsx` — new: the edit form.
- `src/components/ReportButton.tsx` — new: reusable button + modal, used in
  two places.
- `src/pages/ListingDetail.tsx` — added "Edit listing" (owner) and "Report
  listing" (non-owner) buttons.
- `src/pages/SellerProfile.tsx` — added "Report user" button (hidden on your
  own profile).
- `src/App.tsx` — added the `/listing/:id/edit` route (behind `RequireAuth`).

Verified in this session: `npm install`, `npx tsc --noEmit`, and `npm run
build` all pass clean with zero errors.
