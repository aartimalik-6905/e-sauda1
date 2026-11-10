# feature/my-listings-and-report-notify — setup guide

## Part 1: My Listings management page

What it does:

- New **"My listings"** link (in the account dropdown, and the Profile
  page's "Active listings" stat is now clickable too) → `/my-listings`.
- Shows *every* listing you've ever posted -- active, sold, or removed --
  with a status badge on each, not just a bare count like Profile showed
  before.
- Each row links to the listing, plus an **Edit** button (active listings
  only -- editing a sold/removed listing isn't meaningful) and a **Delete**
  button (any status).

No SQL migration needed -- `fetchUserListings()` already returned every
status (Profile's count just never showed the underlying list), and the
existing "Users can update/delete their own listings" RLS policies already
cover this page's actions.

### Test it

1. Post two or three listings so there's something to manage.
2. Click your avatar → **"My listings"** → confirm you see all of them with
   correct status badges.
3. Click **Edit** on one → confirm it takes you to that listing's edit
   page (same page from feature/edit-listing-and-reports).
4. Mark one as sold (however your existing sold-flow does that, e.g.
   completing a Vault order) → revisit `/my-listings` → confirm it shows
   as "sold" and no longer has an Edit button.
5. Click **Delete** on a listing → confirm the confirmation prompt, then
   confirm it disappears from the list.
6. From Profile, click the **"Active listings"** stat card → confirm it
   takes you to `/my-listings` too.

## Part 2: Notify the reporter when their report is actioned

What it does:

- Previously, filing a report was a one-way action -- you'd never know if
  anyone looked at it. Now, the moment an admin marks a report **reviewed**
  or **dismissed**, the person who filed it gets a real notification
  (same bell dropdown as messages/vault notifications).
- The notification links to whatever the report was about -- the listing
  if it named one, otherwise the reported user's profile.
- Fires exactly once, the first time a report leaves `open` -- if a report
  somehow gets toggled back and forth, the reporter isn't spammed for
  every flip.

### 1. Run the SQL migration

Requires `reports_schema.sql` and `notifications_schema.sql` already
applied. Then run `supabase/report_notify_schema.sql` in the SQL Editor.

This widens the `notifications.type` check constraint to allow two new
values (`report_reviewed`, `report_dismissed`) and adds a trigger on
`reports` that fires on status change.

### 2. Test it

1. As a regular user, file a report on a listing (from
   feature/edit-listing-and-reports's Report button).
2. As an admin, go to `/admin`, find that report, click **Mark reviewed**.
3. Log back in as the reporter → confirm the bell shows a new "Your report
   was reviewed" notification, and clicking it takes you to the listing.
4. Repeat with **Dismiss** on a different report → confirm the reporter
   gets "Your report was reviewed" with dismissal-appropriate body text.
5. File a report that names a **user** but no listing (e.g. from Report on
   a seller profile) → action it as admin → confirm the notification links
   to that user's seller profile instead of a listing.

## Design notes

**Why My Listings needed no SQL.** This is a case where the backend was
already fully capable (`fetchUserListings` never filtered by status, and
the RLS policies already scoped update/delete to the owner) -- the gap was
purely that no UI ever surfaced the list. Worth calling out because it's
a reminder to check "does the data layer already support this?" before
assuming a new feature needs a migration.

**Why the notification trigger only fires on the *first* status change out
of 'open'.** `old.status <> 'open'` in the trigger guard means re-reviewing
or flip-flopping a report's status doesn't re-notify -- notifications
should mean "something new happened," not fire on every edit.

## Files touched in this branch

- `src/pages/MyListings.tsx` — new: the management page.
- `src/App.tsx` — added the `/my-listings` route.
- `src/components/Navbar.tsx` — added "My listings" to the account
  dropdown.
- `src/pages/Profile.tsx` — made the "Active listings" stat a link to
  `/my-listings`.
- `supabase/report_notify_schema.sql` — new: widened `notifications.type`
  constraint + trigger on `reports`.
- `src/types.ts` — widened `NotificationType` to include the two new
  values (no other client changes needed -- the notification UI already
  renders generically off `title`/`body`/`link`, not `type`).

Verified in this session: `npm install`, `npx tsc --noEmit`, and `npm run
build` all pass clean with zero errors.
