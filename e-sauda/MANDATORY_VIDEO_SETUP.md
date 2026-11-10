# feature/mandatory-video — setup guide

Sellers now must attach a short video actually showing the item before
publishing a **new** listing — photos alone are no longer enough. Mirrors
the existing photo-upload feature's storage pattern almost exactly.

## What it does

- The Sell wizard's Media step now has two sections: photos (still
  optional, unchanged) and video (**required** — the Next button won't
  advance past this step without one).
- Videos are capped at **50MB and 60 seconds** — duration is checked for
  real, client-side, by loading the file's metadata before accepting it
  (not just trusting the file extension).
- If the video upload fails after the listing's otherwise published
  (network blip, etc.), the listing still goes through — you get a clear
  warning telling you to add it from **My Listings → Edit**, which now has
  a real add/replace/remove video section (this didn't exist before; it's
  part of this same branch).
- The video plays on the listing's detail page, right under the photo
  gallery.
- **Existing listings** (posted before this feature) simply have no video
  — there's no way to retroactively require one, so this only applies
  going forward. `ListingDetail`/`EditListing` both handle a missing video
  gracefully rather than showing a broken player.

## 1. Run the SQL migration

Requires `image_upload_schema.sql` already applied (mirrors its bucket/
policy pattern). Then run `supabase/video_upload_schema.sql` in the SQL
Editor.

## 2. Test it

1. Start posting a new listing → get to the Media step → try clicking
   **Next** without adding a video → confirm it's disabled.
2. Upload a video under 60 seconds → confirm a preview player appears
   with a remove (×) button, and **Next** is now enabled.
3. Try uploading a video **over 60 seconds** → confirm you get a clear
   duration error and it's rejected before ever reaching storage.
4. Try uploading a non-video file (rename a `.txt` to `.mp4`, or just pick
   an image) → confirm the type check catches it.
5. Finish publishing → go to the listing's detail page → confirm the
   video plays there, under the photos.
6. Go to **My Listings → Edit** on that same listing → confirm the video
   shows there too, and you can remove it or replace it with a different
   clip, with changes saving immediately (same pattern as photos).
7. Open an **old** listing (posted before this feature) → confirm its
   detail page and edit page both work fine with no video section shown
   awkwardly — no broken player, no "video required" nagging on something
   that predates the requirement.

## Design notes

**Why duration is checked client-side via a real `<video>` element,
not just trusted from file metadata/extension.** A file's declared
duration/type can be wrong or spoofed trivially (rename anything to
`.mp4`); actually loading it into a video element and reading
`video.duration` from the browser's own decoder is a real check, not a
label check. It does mean a small delay ("Checking video…") between
picking a file and it being accepted — worth it for an actual guarantee
over a cosmetic one.

**Why a failed video upload doesn't block the whole listing from
publishing.** Same reasoning as the pre-existing photo-upload failure
handling: by the time the video upload could fail, the listing row
already exists successfully. Rolling that back over a transient storage
hiccup would be worse than letting the listing stand and pointing to a
concrete recovery path — which now actually exists (Edit Listing's video
section), unlike the stale message this replaced that referenced a
feature that hadn't been built yet.

**Why existing listings aren't retroactively required to add a video.**
There's no reasonable way to force a video onto something already posted
without asking every existing seller to go fix their listings after the
fact. Enforcement lives entirely in the Sell wizard's own validation, not
a database constraint — `video_url` stays nullable at the schema level on
purpose.

## Files touched in this branch

- `supabase/video_upload_schema.sql` — new: `listing-videos` bucket +
  storage policies + `video_url` column.
- `src/lib/storage.ts` — added `validateVideoFile`, `validateVideoDuration`,
  `uploadListingVideo`, `deleteListingVideo`.
- `src/lib/listings.ts` — added `attachVideo`, `updateListingVideo`; mapped
  `video_url` in `mapRow`.
- `src/types.ts` — added `videoUrl` to `Listing`.
- `src/pages/Sell.tsx` — mandatory video step in the wizard; also fixed a
  stale warning message that referenced an already-shipped feature as if
  it didn't exist yet.
- `src/pages/EditListing.tsx` — new video add/replace/remove section,
  mirroring the existing photo management UI.
- `src/pages/ListingDetail.tsx` — video player on the listing detail page.

Verified in this session: `npm install`, `npx tsc --noEmit`, and `npm run
build` all pass clean with zero errors.
