# feature/admin-reports — setup guide

What this does: a `/admin` page for reviewing reports filed via
feature/edit-listing-and-reports, instead of digging through the Supabase
Table Editor by hand. Only accounts with `profiles.is_admin = true` can see
it — everyone else gets a plain "Not authorized" page, and there's no link
to `/admin` anywhere in the UI unless you're already an admin (it appears
in your account dropdown, not the main nav).

**Requires `supabase/reports_schema.sql` to already be applied** (from
feature/edit-listing-and-reports) — this branch adds to that table, it
doesn't create it.

## 1. Run the new SQL migration

Supabase dashboard → SQL Editor → New query → paste the entire contents of
`supabase/admin_schema.sql` → Run.

This adds an `is_admin` boolean to `profiles` (default `false` for
everyone), a small `is_admin()` helper function, and three RLS policies:
admins can see *all* reports (not just ones they filed), admins can update
a report's `status`, and admins can view any listing (even sold/removed
ones, so a report about a since-deleted listing is still reviewable).

## 2. Make yourself an admin

Nothing in the UI can do this on purpose — it has to be a deliberate,
one-time action in the SQL editor, not a client-side toggle. Run this in
the SQL editor, replacing the email:

```sql
update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'you@example.com');
```

## 3. Install and run

```bash
npm install
npm run dev
```

## 4. Test it

1. Log in as your now-admin account → click your avatar → confirm you see
   a **"Reports (admin)"** item in the dropdown that a non-admin account
   doesn't have.
2. Click it → you should land on `/admin` showing your **open** reports
   (from earlier testing of the report feature) with reason, details,
   who filed it, and who/what it's about.
3. Click a reported user's name → confirms it links to their seller
   profile. Click a reported listing's title → confirms it links to that
   listing (even if the listing status shown next to it says "sold" or
   "removed").
4. Click **"Mark reviewed"** on one → confirm it disappears from the
   "open" tab, then switch to the **"reviewed"** tab and confirm it shows
   up there instead.
5. Click **"Dismiss"** on another → same check, but for the "dismissed"
   tab.
6. Switch to the **"all"** tab → confirm you see reports of every status
   together.
7. Log in as a **non-admin** account and navigate directly to `/admin` in
   the URL bar → confirm you get "Not authorized", not the reports list
   (this is the RLS-backed check, not just a UI hide — even if someone
   found the route, the `fetchReports` query would return nothing for a
   non-admin because of RLS).
8. As that non-admin account, open the browser console and try
   `supabase.from('reports').select('*')` directly → confirm you only get
   back reports *that account* filed, not everyone's (RLS still applies
   regardless of what the UI does).

## Design notes

**Why a boolean on `profiles` instead of a roles table.** This app has
exactly one elevated role (admin) with no need for finer-grained
permissions yet. A `roles`/`user_roles` table with many-to-many
relationships would be solving a problem this app doesn't have — it's easy
to migrate to later if you ever need e.g. "moderator who can't ban" as a
separate tier.

**Why `is_admin()` is `security definer`.** Without it, the RLS policies on
`reports`/`listings` that check "is the current user an admin" would need
to read `profiles` — but `profiles` itself has RLS enabled, and a plain
(non-definer) subquery would be subject to the *reader's own* RLS on
`profiles`, not necessarily able to see the `is_admin` column in a way that
composes cleanly. Making the helper function `security definer` sidesteps
that entirely: it runs with the privileges to check anyone's `is_admin`
flag, but only ever returns a boolean — it can't be used to leak any other
profile data.

**Why no embedded joins in `fetchReports`.** `reports.reported_user_id`
points at `auth.users`, not `public.profiles`, so PostgREST can't
auto-detect that relationship for a `.select('reported_user:profiles(...)')`
style embed. Two `.in()` lookups (one for the involved users, one for the
involved listings) and stitching the results together client-side is
simpler than fighting that, and `/admin` is a low-traffic page — not worth
optimizing into a single round trip.

## Files touched in this branch

- `supabase/admin_schema.sql` — new: `is_admin` column, `is_admin()`
  helper, and three admin-only RLS policies.
- `src/context/AuthContext.tsx` — added `is_admin` to the `Profile`
  interface and the fetch query.
- `src/lib/admin.ts` — new: `fetchReports()`, `updateReportStatus()`.
- `src/pages/Admin.tsx` — new: the `/admin` page.
- `src/App.tsx` — added the `/admin` route (behind `RequireAuth`; the page
  itself does the `is_admin` check).
- `src/components/Navbar.tsx` — added a "Reports (admin)" link to the
  account dropdown, shown only when `profile.is_admin` is true.

Verified in this session: `npm install`, `npx tsc --noEmit`, and `npm run
build` all pass clean with zero errors.
