# feature/edit-listing-photos — setup guide

## How I found this one

Same approach as last round — I read the actual code instead of proposing
something speculative. `EditListing.tsx` let you fix a title, price,
condition, description, or city, but never touched `photoUrls` at all.
Once a listing was posted, there was no way to add a forgotten angle,
swap a blurry photo, or remove one — your only option was deleting the
whole listing and reposting, which loses its chat history and saved-item
count (the exact problem edit-listing was built to avoid in the first
place, just not all the way).

## What this feature does

The **Edit listing** page now has a **Photos** section above the rest of
the form:
- Existing photos show with a small ✕ to remove them individually
- An "Add" tile lets you upload more (up to the existing 6-photo cap)
- Both save **immediately** when you click/select — not batched with the
  rest of the form's "Save changes" button, since that's how removing or
  adding something already feels everywhere else in this app (My
  Listings' delete, mark-as-sold, etc.)

## A real bug I caught and fixed while building this

`uploadListingPhotos()` always numbered new files starting at index 0
(`{ownerId}/{listingId}/0-filename.jpg`, `1-filename.jpg`, ...). That's
fine the first time a listing is posted, but adding *more* photos to an
already-photographed listing later would restart at index 0 too —
combined with the upload using `upsert: true`, this could silently
**overwrite an existing photo in storage** if the new file happened to
share the same filename as the original (a real risk — phone galleries
often reuse generic names like `IMG_1234.jpg`).

Fixed by adding an optional `startIndex` parameter, so adding photos from
the edit page continues numbering from how many photos already exist
instead of restarting at 0. Posting a **new** listing from Sell.tsx is
unaffected — it doesn't pass this parameter, so it keeps its original
start-at-0 behavior.

## 1. No SQL migration needed

The storage delete policy needed for per-photo removal already existed
in `image_upload_schema.sql` ("Users can delete their own listing
photos") — nothing new to run.

## 2. Install and run

```bash
npm install
npm run dev
```

## 3. Test it

1. Go to **My Listings** → **Edit** on a listing that already has photos.
2. Remove one photo (✕) — confirm it disappears immediately (no need to
   click "Save changes"), and check the listing detail page — that photo
   should be gone there too.
3. Add 1–2 new photos — confirm they appear immediately in the grid.
4. Go back to the listing detail page and confirm the new photos show up
   in its gallery too.
5. Try adding photos past the 6-photo cap — confirm you get a clear
   "up to 6 photos total" message instead of it silently failing.
6. Try uploading a non-image file — confirm the existing file-type
   validation still catches it (reused from the Sell wizard, unchanged).
7. As a sanity check on the bug fix: post a **brand-new** listing with
   photos via Sell as usual — confirm nothing regressed there (numbering
   still starts at 0 for a fresh listing, same as before this branch).

## Files touched in this branch

- `src/lib/storage.ts` — added `deleteListingPhotoByUrl()`, exported
  `MAX_PHOTOS`, added the `startIndex` parameter to `uploadListingPhotos()`.
- `src/lib/listings.ts` — added `updateListingPhotos()`.
- `src/pages/EditListing.tsx` — new Photos section (add/remove, saves immediately).

Verified in this session: `npm install`, `npx tsc --noEmit`, and
`npm run build` all pass clean with zero errors.
