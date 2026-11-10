> **Note (Nov 2026):** e-Sauda is now a C2C classifieds platform with no escrow/Vault. Sections below that mention the Vault, orders, OTP handover, delivery or KYC are out of date. See `C2C_MIGRATION.md`.

# e-Sauda — Full Manual Testing Guide

This is a click-through checklist for every page, button, and flow in the app,
organized by role (Buyer, Seller, Admin) and then by feature. Use three
browser profiles/incognito windows (or three test accounts) so you can be
buyer, seller, and admin at the same time without logging in/out constantly.

Before you start, read the "Setup prerequisites" section — several features
will look broken if the underlying Supabase migration or secret hasn't been
applied yet, and that's a config issue, not a code bug.

---

## 0. Setup prerequisites (do this first)

- [ ] All SQL files in `supabase/` have been run, **in the order their setup
      docs say** (several depend on an earlier one — e.g.
      `listing_fee_schema.sql` is a legacy migration; apply `cashfree_listing_fee_schema.sql` after the existing listing-fee, geolocation and media migrations). If you're
      not sure what's already applied, re-running a migration that uses
      `create or replace` / `if not exists` is safe.
- [ ] `video_upload_schema.sql` and `image_upload_schema.sql` have been run
      (Sell now requires a video on every new listing — see §3).
- [ ] Supabase Edge Function secrets are set:
      `CASHFREE_APP_ID` / `CASHFREE_SECRET_KEY` — the current integration is explicitly configured for Cashfree Production mode. Do not test with live credentials until ready to accept real payments (see `CASHFREE_SETUP.md`). Deploy the Cashfree functions described there. All required functions in `supabase/functions/` are
      deployed (`supabase functions deploy <name>` for each, or `--all` if
      your CLI version supports it).
- [ ] `.env` / Vercel project env vars have `VITE_SUPABASE_URL` and
      `VITE_SUPABASE_ANON_KEY` set.
- [ ] `npm install && npm run build` completes with no errors (this was
      verified clean as of this branch — if it breaks after further changes,
      fix that before testing UI behavior on top of a broken build).

---

## 1. Account creation & auth (test as a brand-new user)

Route: `/signup`, `/login`, `/forgot-password`, `/reset-password`,
`/verify-phone`

- [ ] Sign up with a new email + password → confirm you land signed-in (or
      get a clear "check your email" message if email confirmation is on in
      your Supabase Auth settings).
- [ ] Try signing up with an email already in use → confirm a clear error,
      not a silent failure.
- [W] Log out, log back in with the same credentials → works.
- [W] Log in with a wrong password → clear error, no crash.
- [ ] **Forgot password**: request a reset → check the email arrives → click
      the link → land on `/reset-password` → set a new password → log in
      with the new one.
- [ ] **Phone verification** (`/verify-phone`, gated behind `RequireAuth`):
      request an OTP → confirm it's sent (check `send-phone-otp` function
      logs if it doesn't arrive) → enter it → confirm it verifies → enter a
      wrong OTP → confirm a clear rejection, not a crash.
- [ ] Try visiting any `RequireAuth`-gated route (`/sell`, `/my-listings`,
      `/orders`, `/vault`, `/profile`, `/saved`, `/admin`, `/messages`,
      `/listing/:id/edit`) while logged out → confirm you're redirected to
      login rather than seeing a broken/empty page.

---

## 2. Browse & search (as any logged-in or logged-out user)

Route: `/` (Home) and `/browse`

- [ ] Home page loads, shows a "fresh listings" grid without erroring even on
      an empty database.
- [ ] Home page's feature list no longer mentions voice or AR (confirm: it
      should read "Vaulted escrow", "Progressive trust limits", "One-tap city
      delivery", "AI-cleaned photos" only — four cards, not the old six).
- [ ] Category tabs on `/browse` (All / Mobiles / Vehicles / etc.) filter the
      grid correctly.
- [ ] Search box: type a term that matches a listing title → results narrow
      after the debounce (~350ms). Type something matching nothing → the
      "No listings match..." empty state shows, not a blank screen or error.
- [ ] Search box is also reachable from the Navbar and deep-links to
      `/browse?q=...` — confirm the URL updates and is shareable/refreshable.
- [ ] **City filter** (left sidebar, "Filters" → "City"): select a specific
      city → confirm the grid narrows to listings whose location contains
      that city; select "All cities" → confirm it resets. (This filter was
      previously non-functional — verify it now actually filters, and that
      it combines correctly with category/price/search filters at the same
      time.)
- [ ] Price Min/Max fields filter correctly, and combine correctly with
      category + city + search all at once.
- [ ] Sort dropdown: "Price: Low to High", "Price: High to Low", "Nearest
      first" all reorder the grid as expected.
- [ ] Each listing card shows: price, title, location + distance, an Escrow
      badge (every listing should have this — escrow is always on),
      ✓ Verified badge only for verified sellers. **Confirm there is no AR
      badge and no 360° badge anywhere** — those were removed along with the
      feature.
- [ ] Heart/save icon on a card: toggles filled/unfilled instantly; if
      logged in, confirm it persists (reload the page, still saved); if
      logged out, confirm it still visually toggles locally without erroring
      (it just won't persist).
- [ ] "Have something to sell?" CTA at the bottom of Browse links to `/sell`
      and its copy no longer mentions "voice-first" or "20 seconds."

---

## 3. Posting a listing — Seller flow (the big one)

Route: `/sell` (requires login)

### Step 0 — Category
- [ ] Pick each category button → confirms it highlights and the "Listing
      cap in {category}" banner above updates to show your current count for
      that category (fetches live from Supabase).
- [ ] Sub-category free-text field accepts input.
- [ ] If you're at your cap (2 active listings in one category by default),
      confirm the red "You've hit your listing cap" warning shows and the
      **Next** button is disabled.
- [ ] Otherwise confirm the anti-bot fee preview shows (₹1 for your 1st
      listing in that category, ₹10 for the 2nd, ₹25/₹500 tier beyond) and
      updates live if you switch categories.

### Step 1 — Details
- [ ] Confirm there is **no "Speak instead" / microphone button** anywhere
      on this step — that was removed along with the rest of voice.
- [ ] Title, Price, Condition, Description fields all accept and retain
      input when you go Back and Next again (state isn't lost mid-wizard).
- [ ] Price suggestion box: after picking a category (and optionally typing
      a sub-category), wait ~400ms → confirm it either shows a real
      suggested range from existing listings, or a "not enough similar
      listings yet" message — never stuck on "Checking similar listings…"
      forever.
- [ ] Click "Use ₹X" on the suggestion → confirms it fills the Price field.
- [ ] **Location field** (new): type a city/area → confirm it's required —
      Next stays disabled with Title/Price filled in but Location empty.
      Fill it in → Next enables.
- [ ] Next button overall: disabled unless Title, Price, and Location are
      all non-empty (and you're not at your category cap).

### Step 2 — Media
- [ ] **Photos** (optional): upload up to 6 images, remove any with the ×
      that appears on hover, confirm you can publish with zero photos (the
      listing just shows a category emoji instead — this is intentional,
      only video is mandatory).
- [ ] Try uploading a photo over the size limit or wrong file type → confirm
      a clear error, not a crash.
- [ ] **Video (new, mandatory)**: confirm you **cannot click Next** without
      adding a video first.
  - [ ] Upload a short (<60s) real video file → confirm "Checking video…"
        appears briefly, then a preview player renders with a working ×
        remove button, and Next becomes enabled.
  - [ ] Try a video over 60 seconds → confirm a clear duration error and it's
        rejected (not silently accepted).
  - [ ] Try a video over 50MB → confirm a clear size error.
  - [ ] Try renaming a non-video file (e.g. a `.txt`) to `.mp4` and uploading
        it → confirm the type/duration check actually catches it rather than
        trusting the extension.
  - [ ] Remove the video after adding it → confirm Next becomes disabled
        again until you add another.

### Step 3 — Review & publish
- [ ] Review screen shows correct Category, Title, Location, Price,
      Condition, Description, Photos count, Video filename, and the
      anti-bot fee due.
- [ ] Click "Pay ₹X & publish" → Cashfree Checkout modal opens (test mode —
      see §8). Pay with the test card `4111 1111 1111 1111` (any future
      expiry/CVV).
- [ ] Confirm the button label changes through the real states: "Publishing…"
      → "Uploading photos…" (if any) → "Uploading video…" → success screen.
- [ ] On success: confirm the listing published message shows, and if photo
      or video upload failed independently (simulate by killing your network
      briefly during upload), confirm you get a clear warning pointing to
      **My Listings → Edit** to add it — and that the listing itself still
      published rather than being lost.
- [ ] Close the Cashfree modal without paying (click the X) → confirm this is
      treated as "cancelled," not shown as a scary error.
- [ ] Use the Cashfree test UPI ID `Cashfree failed-payment test flow` → confirm you get a
      clear "Payment failed" message.
- [ ] Go to `/browse` → confirm your new listing appears with the correct
      location, and that the City filter can find it.
- [ ] Open the new listing's detail page → confirm the video plays under the
      photo gallery, and **confirm there is no AR/"View in AR" section**
      anywhere on the page — that feature and its dimension inputs were
      removed entirely.

---

## 4. Editing & managing listings — Seller flow

Route: `/my-listings`, `/listing/:id/edit`

- [ ] `/my-listings` lists all of your listings (active, sold, removed) with
      correct status.
- [ ] Click Edit on a listing → confirm Title/Price/Condition/Description/
      Location/City load pre-filled correctly.
- [ ] Confirm there is **no "Dimensions (optional)" section** on the edit
      page — removed with AR.
- [ ] Change a field, Save → confirm it saves and redirects back to the
      listing detail page with the update reflected.
- [ ] Photos section: add a photo, remove a photo → confirm each change
      saves immediately (not deferred to a form submit).
- [ ] Video section: if the listing has no video (an old listing from before
      this feature), confirm it shows a clean "Add a video" upload prompt,
      not a broken player. Add one → confirm it saves and now shows on the
      listing detail page. Replace it, then remove it → both should work and
      persist.
- [ ] Try editing a listing that belongs to someone else (change the URL id)
      → confirm you're blocked ("forbidden" state), not shown their data.
- [ ] Try editing a listing id that doesn't exist → confirm a clean
      "not found" state, not a crash.
- [ ] Mark a listing as sold (wherever that control lives per
      `MARK_AS_SOLD_SETUP.md`) → confirm its status updates and it drops out
      of the public Browse feed.
- [ ] Delete/remove a listing from `/my-listings` → confirm the confirmation
      step works and it's actually removed (or marked removed) afterward.

---

## 5. Listing detail & buyer purchase flow

Route: `/listing/:id`

- [ ] All fields render: title, price, condition, description, location,
      photos gallery, video (if present), seller info, Escrow badge.
- [ ] Save/heart button toggles and persists for logged-in users.
- [ ] "Message seller" opens/creates a conversation and routes to
      `/messages/:id`.
- [ ] "Buy with Vault" button → opens Cashfree Checkout (test mode) for the
      **listing's real price**, not something editable by the buyer. Try
      intercepting the request in devtools to change the amount — confirm
      the server (Edge Function) still charges the real DB price, since the
      amount is read server-side.
- [ ] Complete a test payment → confirms a Vault order is created and shows
      up on both your `/vault` (Buying tab) and the seller's `/vault`
      (Selling tab).
- [ ] Report button on the listing → submits a report, confirm it appears in
      `/admin` for review (see §9).
- [ ] "You might also like" / recommendations section loads without erroring
      even for a listing with few similar items.
- [ ] Confirm again: **no AR try-on control anywhere** on this page.

---

## 6. Messaging & offers

Route: `/messages`, `/messages/:id`

- [ ] Conversation list loads, shows correct last message preview and
      timestamp.
- [ ] Send a message → appears instantly for you, and (open a second
      browser/account) appears in near-real-time for the other party.
- [ ] Send a message containing something that should trigger moderation
      (per `CHAT_MODERATION_SETUP.md`, e.g. sharing a phone number) → confirm
      it's flagged/handled as documented, not silently allowed if the docs
      say it shouldn't be.
- [ ] Make a price offer inline in chat (per chat-offers feature) → confirm
      it renders as a distinct offer bubble with Accept/Decline/Withdraw
      controls visible to the correct party only.
- [ ] Accept an offer as the seller → confirm the buyer sees it reflected as
      accepted, and that this connects correctly to the price used at
      checkout (per `fetchMyAcceptedOffer`).
- [ ] Decline / withdraw an offer → confirm state updates correctly on both
      sides.
- [ ] Block a user (per `blocking_schema.sql` / `MODERATION_ACTIONS_AND_BLOCKING_SETUP.md`)
      → confirm you no longer receive messages from them and can't message
      them back.
- [ ] Chatbot widget (bottom corner, all pages) → open it, ask a question →
      confirm it responds via the `chat-assistant` Edge Function rather than
      failing silently.

---

## 7. Vault (escrow), OTP handover, delivery, cancellation

Route: `/vault`

**As buyer (Buying tab):**
- [ ] Funded order shows "FUNDS SECURED" status clearly.
- [ ] Arrange delivery (Rapido/Uber/Dunzo per `DELIVERY_SETUP.md`) → confirm
      a rider/partner, ETA, and fee show and persist.
- [ ] Reveal handover OTP → confirm a 4–6 digit code displays only to you.
- [ ] Mark delivered (if applicable) → confirms status updates.
- [ ] Cancel an order with a reason → confirm the refund amount shown makes
      sense (full refund if no delivery arranged yet; a reduced amount if a
      delivery fee had already been committed, per `DISPUTE_FEE_SETUP.md`) →
      confirm the cancellation actually triggers `cancel-vault-order-and-refund`
      and the Cashfree refund shows up (in test mode, check the Cashfree
      Dashboard's test-mode payments).

**As seller (Selling tab):**
- [ ] See the same order show up as a sale.
- [ ] Enter the OTP the buyer revealed → confirm it completes the order and
      releases funds (status → completed) only on a correct OTP; a wrong OTP
      is rejected with a clear error, not silently accepted.
- [ ] After completion, confirm a rating prompt/flow becomes available (see
      §8) and the listing's status becomes "sold" if that's tied together.

---

## 8. Payments — Cashfree test mode

The current requested implementation uses Cashfree **Production** mode and the production API endpoint. Do not run live payment tests unless your merchant account is approved and you are ready to collect real money. For sandbox testing, explicitly change both the Edge Function API base URL and the frontend SDK mode to `sandbox`, use sandbox credentials, then restore Production mode before deployment. See `CASHFREE_SETUP.md`.

- [ ] Listing-fee payment (Sell wizard's "Pay ₹X & publish") completes with
      an approved Cashfree test method only after switching both backend and SDK to sandbox.
- [ ] Vault/escrow payment is a separate legacy flow; verify its gateway independently.
- [ ] Verify successful payment publishes the listing only after server-side PAID verification.
- [ ] Verify failed, cancelled and pending payments do not publish the listing.
- [ ] Do not assume Vault refunds are part of this listing-fee migration.
- [ ] Confirm that production mode is enabled only after the merchant account, domain and webhook are configured.

---

## 9. Ratings, notifications, saved items, price alerts

- [ ] After a completed Vault order, rate the other party (stars + comment)
      → confirm it saves and shows on their `/seller/:id` public profile.
- [ ] Notifications bell/page: confirm you get a notification for new
      messages, funded vault orders, completed orders, cancelled orders, and
      report outcomes — click through each to confirm it deep-links
      correctly and marks itself read.
- [ ] `/saved`: confirm every listing you hearted shows up here, and
      unsaving from either Browse or here keeps both in sync.
- [ ] Price drop alert: as a seller, drop a listing's price → confirm buyers
      who saved it get a notification (per `FORGOT_PASSWORD_AND_PRICE_DROP_SETUP.md`).

---

## 10. Account & profile

Route: `/profile`, `/seller/:id`

- [ ] `/profile` shows correct trust score, completed saudas, active listing
      count (links through to `/my-listings`), saved count.
- [ ] "Verify with DigiLocker" button is disabled and labeled "Coming soon" —
      confirm it's not clickable and doesn't pretend to do something it
      can't (this was a dead button before; it's intentionally disabled now
      until the integration actually exists).
- [ ] Badges section reflects real unlocked/locked state based on your
      actual activity, not hardcoded.
- [ ] Dark mode toggle: confirm it actually switches theme, and persists on
      reload (check `useTheme.ts` / the inline script in `index.html` agree
      with each other — no flash of wrong theme on load).
- [ ] Account deletion flow (per `LISTING_FEE_AND_ACCOUNT_DELETION_SETUP.md`)
      → confirm it requires confirmation, actually calls the
      `delete-account` function, and you're logged out and can no longer log
      back in with those credentials afterward.
- [ ] `/seller/:id` public profile: shows their rating, review count, active
      listings — confirm it does **not** leak private info (email, phone)
      to other users.

---

## 11. Admin role

Route: `/admin` (any logged-in user can currently reach the route — confirm
whether admin-only access is enforced at the Supabase RLS/role level per
`ADMIN_REPORTS_SETUP.md`; if a non-admin account can see this page and act on
reports, that's a real access-control bug worth flagging separately from
this checklist)

- [ ] Tabs: Open / Reviewed / Dismissed / All — each filters the reports
      list correctly.
- [ ] Mark a report Reviewed → moves out of "Open" into "Reviewed" (and
      shows in "All").
- [ ] Dismiss a report → same, moves to "Dismissed."
- [ ] "Remove listing" action on a report → confirm the listing actually
      disappears from Browse afterward.
- [ ] "Suspend user" action → confirm that user can no longer post new
      listings (they should see the "Account suspended" message if they try
      `/sell`) and confirm what happens to their existing listings per
      `MODERATION_ACTIONS_AND_BLOCKING_SETUP.md`.
- [ ] Reload the admin page after each action → confirm state matches what
      the DB actually has (not just an optimistic local update that would
      revert on refresh if the backend call silently failed).

---

## 12. Legal & static pages

Route: `/terms`, `/privacy`, `/refund-policy`, `/shipping-policy`,
`/contact`, `/pricing`

- [ ] All six load with real content, not placeholder/lorem-ipsum text.
- [ ] Footer links to all six work and match what's linked in the Navbar (if
      linked there too).
- [ ] Pricing page's stated fees (anti-bot listing fee tiers, delivery fees,
      dispute fees) match what the app actually charges at each of those
      points — cross-check against §3 and §7 above.
- [ ] Footer's "coming soon" list (DigiLocker verification, etc.) — confirm
      every item still listed there is genuinely not live yet; if any of
      them get built later, remove them from "coming soon" at the same time
      or the site will contradict itself again.

---

## 13. Cross-cutting / regression checks

- [ ] **Voice**: search the whole app one more time for any remaining
      mention of "voice," "speak," "microphone," or a mic icon — there
      should be none. (`grep -ri "voice\|microphone" src` should return
      nothing.)
- [ ] **AR**: search for "AR," "model-viewer," "SpaceFitViewer," "spin360" —
      there should be none in app code. (`grep -rn "model-viewer\|SpaceFitViewer\|spin360" src`
      should return nothing.)
- [ ] **Location consistency**: every new listing has a non-empty location;
      Browse's City filter actually narrows results; a listing's location
      shown on its card matches what was typed at posting time.
- [ ] **Video consistency**: every listing created *after* this change has a
      video; listings created *before* this change simply don't show a video
      section (not a broken player).
- [ ] Run `npm run build` — must complete with zero TypeScript errors.
- [ ] Click every nav link in the Navbar (logged-out and logged-in states
      look different — check both) and every link in the Footer — none
      should 404 or dead-end.
- [ ] Resize to mobile width and re-check Sell's wizard, Vault's tabs, and
      Browse's filter sidebar — confirm nothing overlaps or becomes
      unreachable on a small screen.

---

## Known items intentionally left as-is (not bugs)

- **Photos remain optional** on the Sell wizard — only video is mandatory,
  by design (see `MANDATORY_VIDEO_SETUP.md`).
- **Existing listings from before this branch** have no video and aren't
  retroactively required to add one — this is intentional, not a gap.
- **DigiLocker verification** is a real, disabled, honestly-labeled
  "Coming soon" button on `/profile` — it is not wired to anything yet.
  Treat wiring it up as a separate feature, not a bug in this pass.
