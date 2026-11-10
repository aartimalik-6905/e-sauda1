# fix/report-email-otp-video-regression — setup guide

Three fixes, all verified against your latest upload.

## 1. Report notification emails (new feature, not a fix)

Filing a report now sends a real email via Resend to two addresses.

**⚠️ Double-check this before deploying:** you wrote
`annuanshu005@gmail.com` this time, but earlier in our conversation (when
setting up admin accounts) you used `annuanshu2005@gmail.com` — missing
the "20". I used exactly what you typed just now, in one clearly-labeled
constant (`NOTIFY_EMAILS` at the top of
`supabase/functions/notify-report-email/index.ts`) so it's a one-line fix
if that's actually a typo.

### Setup

1. Sign up free at [resend.com](https://resend.com) — no credit card
   needed. Free tier: 100 emails/day, 3,000/month, permanent (not a
   trial).
2. Create an API key → `supabase secrets set RESEND_API_KEY=re_...`
3. Deploy: `supabase functions deploy notify-report-email`

**Read this before assuming emails will just arrive:** without a verified
sending domain, Resend only lets you send *from* their shared address
(`onboarding@resend.dev`), which is what this function uses. Some
providers also restrict which addresses you can send *to* before
verification — if you set the key, deploy, and still don't see emails,
check your Resend dashboard's logs first (it'll tell you exactly why a
send failed) before assuming the code is broken.

**Fire-and-forget by design:** if the email fails for any reason (missing
key, Resend hiccup, whatever), filing the report still succeeds — the
report is saved to the database first, then the email is attempted
separately. A person reporting something should never see an error just
because an email didn't go out.

### Test it

1. File a report on any listing or seller profile.
2. Confirm the report still submits successfully even if you haven't set
   `RESEND_API_KEY` yet (fire-and-forget — check the Edge Function's logs
   for `"RESEND_API_KEY not set"` rather than seeing an error in the UI).
3. Once the key is set, file another report → check both inboxes.
4. Check Resend's dashboard → Logs → confirm the send shows up there too,
   not just "reported success" from the function's own perspective.

## 2. OTP error-swallowing bug (real fix)

This is the **exact same bug class** found and fixed in the payment gateway
integration earlier in our conversation — `supabase.functions.invoke()`
only gives you a generic "Edge Function returned a non-2xx status code"
via `error.message`; the real error your function actually returned is
only accessible via `error.context`. `lib/edgeFunctions.ts` was fixed for this
already; `lib/phoneAuth.ts` was written separately and never got the same
fix, so any real OTP error (rate limit, provider rejection, wrong code)
was showing you a useless generic message instead of what actually went
wrong.

**This alone might explain "OTP not coming"** — if you were seeing a
vague error and assuming the whole feature was broken, the real cause
was probably visible all along, just hidden behind that generic message.

### What to check now that errors are real

1. Try requesting a code → if it fails, you'll now see the *actual*
   reason (e.g. "Please wait a bit before requesting another code" if you
   tried twice within 30 seconds — a real rate limit that was always
   there, just invisible before).
2. **If no `SMS_API_KEY` secret is set**, you should see a **yellow debug
   box directly on the Verify Phone page** showing the code — this is
   intentional (see the MOCKED note in `send-phone-otp`), not a bug. If
   you were expecting a real text message without having set up an SMS
   provider yet, that's the actual gap — not something to debug further
   in the code, but a provider you still need to sign up for (MSG91,
   Twilio, etc.) and wire in.
3. If you *are* expecting the debug box and it's not appearing either,
   check **Supabase Dashboard → Edge Functions → send-phone-otp → Logs**
   for the real server-side error — that'll tell us the actual next step.

## 3. Mandatory video upload — restored

This had completely disappeared from `Sell.tsx` — not a subtle bug, the
entire video section, its state, and the Next-button requirement were
gone. Checked and confirmed this is the **same pattern as the earlier
Navbar regression**: later work touched `Sell.tsx` and the file got
overwritten with a version that predated the video feature.

The good news: the underlying infrastructure (`validateVideoFile`,
`validateVideoDuration`, `uploadListingVideo` in `lib/storage.ts`;
`video_url` support in `lib/listings.ts`; `videoUrl` in `types.ts`) was
all still intact — only the UI wiring in `Sell.tsx` was lost, so this was
a smaller fix than rebuilding from scratch.

One adjustment: the original `attachVideo` function in `lib/listings.ts`
didn't survive either — only `updateListingVideo` (added later for Edit
Listing) did. They do the exact same thing, so `Sell.tsx` now calls
`updateListingVideo` instead of recreating a duplicate function.

### Test it

1. Start posting a new listing → get to the Media step → confirm you see
   the **"Add a video"** section again, and that **Next stays disabled**
   until a video's attached.
2. Upload a short clip → confirm the preview player and duration/size
   validation both work (try one over 60 seconds to confirm it's
   rejected).
3. Publish → confirm the video shows on the listing's detail page.

## A note on regressions like #3

This is the **second time** a feature has silently vanished because a
later change overwrote a file without preserving earlier work (the first
was the notification bell in the navbar, a while back). Both times, the
underlying data/logic layer survived and only the UI wiring was lost —
which is recoverable, but only because I happened to check. If you're
building with another tool/session in between our conversations here,
worth doing a quick smoke-test of previously-working features (post a
listing, check the bell, etc.) after any large change, the same way we
verify with `tsc`/`build` here — those checks catch type errors, not
"a whole feature quietly disappeared" style regressions.

## Files touched in this branch

- `supabase/functions/notify-report-email/index.ts` — new.
- `src/lib/reports.ts` — calls the new function after a successful report
  insert, fire-and-forget.
- `src/lib/phoneAuth.ts` — fixed to use `invokeFunction` (real error
  messages) instead of a raw `supabase.functions.invoke` call.
- `src/pages/Sell.tsx` — mandatory video upload section, state, handlers,
  and Next-button gate all restored; imports `updateListingVideo` instead
  of the no-longer-existing `attachVideo`.

Verified in this session: `npm install`, `npx tsc --noEmit`, and `npm run
build` all pass clean with zero errors.
