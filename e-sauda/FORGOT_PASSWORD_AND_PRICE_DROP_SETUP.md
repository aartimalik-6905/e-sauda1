# feature/forgot-password-and-price-drop-alerts — setup guide

## Part 1: Forgot password

What it does:

- **"Forgot password?"** link on the Login page → `/forgot-password`, enter
  your email → Supabase sends a reset link.
- The link lands on `/reset-password`, where you set a new password.
- Deliberately shows the **same** "check your email" confirmation whether
  or not the email actually matches an account -- otherwise this form would
  let anyone check which emails are registered on the site.

No SQL migration -- this uses Supabase's built-in auth methods
(`resetPasswordForEmail` / `updateUser`), not any of your own tables.

### 1. One-time Supabase config check

Supabase Dashboard → **Authentication** → **URL Configuration** → make sure
your site URL (and `http://localhost:5173` for local dev) is listed under
**Redirect URLs**. Without this, Supabase will reject the redirect back to
`/reset-password` even though the email itself sends fine.

Also check **Authentication** → **Email Templates** → **Reset Password** is
enabled (it is by default on a new project).

### 2. Test it

1. Go to `/login` → click **"Forgot password?"** → enter your email →
   submit → confirm you see "Check your email".
2. Check your inbox (check spam too -- Supabase's default sender can land
   there) for the reset email → click the link.
3. Confirm you land on `/reset-password` and briefly see "Verifying your
   link…" before the form appears (this is the token being read out of the
   URL).
4. Enter a new password under 6 characters → confirm you get a validation
   error instead of it submitting.
5. Enter two different values in "New password" / "Confirm password" →
   confirm you get "Passwords don't match."
6. Enter a valid matching password → submit → confirm "Password updated"
   appears, then you're redirected to the homepage.
7. Log out, log back in with the **new** password → confirm it works (and
   the old one doesn't).
8. Visit `/reset-password` directly (not via an emailed link) → confirm
   you eventually see "Link expired" rather than a form that would fail
   silently.

## Part 2: Price-drop alerts on saved items

What it does:

- If a seller lowers the price on a listing, **everyone who's saved it**
  gets a notification -- "[title] is now Rs X (was Rs Y)" -- linking
  straight to the listing.
- Only fires on a genuine **drop** on a **still-active** listing -- raising
  the price, or editing a sold/removed listing's price, doesn't notify
  anyone.
- Triggers off the existing `updateListing()` path (from
  feature/edit-listing-and-reports) -- no new code needed on the seller's
  side, editing the price is already how this gets triggered.

### 1. Run the SQL migration

Requires `saved_items_schema.sql` and `notifications_schema.sql` already
applied. Then run `supabase/price_drop_alerts_schema.sql` in the SQL
Editor.

### 2. Test it

1. As buyer B, save one of seller A's listings (heart icon).
2. As seller A, go to that listing → **Edit listing** → lower the price →
   Save.
3. Log back in as B → confirm the bell shows "Price dropped on a saved
   item" and clicking it goes straight to the listing.
4. As A, edit the same listing again but **raise** the price → confirm B
   does *not* get a notification this time.
5. As A, lower the price on a listing **nobody has saved** → confirm no
   notification is created for anyone (nothing to check in the UI here,
   just confirms the trigger doesn't error on zero savers).
6. Have a **second** buyer, C, also save the same listing as B → drop the
   price again → confirm both B and C get notified from the same edit.

## Design notes

**Why the same "generic email" response for forgot-password regardless of
whether the account exists.** This is a standard security practice --
if the form said "no account with that email" for invalid emails and
"check your inbox" for valid ones, anyone could use the form to enumerate
which emails have accounts on your site, one guess at a time.

**Why `ResetPassword.tsx` waits for a `PASSWORD_RECOVERY` event instead of
assuming a session exists on mount.** Supabase's client reads the recovery
token out of the URL asynchronously when the page loads (via
`detectSessionInUrl`), so a session isn't guaranteed to exist in the very
first render. Waiting for the event (with a `getSession()` fallback in case
it already fired, and a 4-second timeout treated as an invalid/expired
link) avoids a form that appears usable but would fail on submit.

**Why price-drop notifications didn't need any new client-side code beyond
widening the `NotificationType` union.** Same reasoning as the
report-notification feature: the notification bell already renders
generically off `title`/`body`/`link`, not `type`, so a new notification
type just works the moment the trigger that creates it exists.

## Files touched in this branch

- `src/context/AuthContext.tsx` — added `requestPasswordReset()`,
  `updatePassword()`.
- `src/pages/ForgotPassword.tsx` — new.
- `src/pages/ResetPassword.tsx` — new.
- `src/pages/Login.tsx` — added the "Forgot password?" link.
- `src/App.tsx` — added `/forgot-password` and `/reset-password` routes.
- `supabase/price_drop_alerts_schema.sql` — new: widened
  `notifications.type` constraint + trigger on `listings`.
- `src/types.ts` — widened `NotificationType` to include `price_drop`.

Verified in this session: `npm install`, `npx tsc --noEmit`, and `npm run
build` all pass clean with zero errors.
