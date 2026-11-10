# feature/image-upload — setup steps

Real photo uploads, replacing the placeholder Upload box in `/sell`. Photos go to Supabase
Storage (free tier: 1GB storage / 2GB bandwidth per month — plenty for development).

## 1. Make the branch

```bash
git checkout main
git pull origin main
git checkout -b feature/image-upload
```

## 2. Copy these files into your project (overwrite the existing ones)

New files:
- `supabase/image_upload_schema.sql`
- `src/lib/storage.ts`

Changed files:
- `src/types.ts` — `Listing` now has `photoUrls: string[]`
- `src/lib/listings.ts` — `mapRow` reads the new column; added `attachPhotos()`
- `src/pages/Sell.tsx` — Media step now actually uploads; publish flow uploads photos
  right after creating the listing row
- `src/pages/Orders.tsx` — deleting a listing now also cleans up its photos in storage
- `src/components/ListingCard.tsx` — shows the first real photo when one exists, falls
  back to the category emoji otherwise

## 3. Run the SQL

Supabase dashboard → SQL Editor → New query → paste all of `supabase/image_upload_schema.sql`
→ Run. This does three things:
- adds a `photo_urls` column to `listings`
- creates a public storage bucket called `listing-photos`
- adds storage policies so a user can only upload/delete files inside their *own* folder
  (path convention: `{owner_id}/{listing_id}/{filename}`), while anyone can view a photo

**Double-check afterward:** Supabase dashboard → Storage (left sidebar) — you should see a
`listing-photos` bucket listed there.

## 4. Install and run

```bash
npm install
npm run dev
```

## 5. Test it

1. Go to `/sell`, fill in category/details, then on the Media step upload 1–3 real photos.
2. You should see instant previews with a hover "✕" to remove one.
3. Publish. On the success screen, you shouldn't see the amber "photo upload failed" warning.
4. Check `/browse` — your listing's card should show the real photo instead of the emoji.
5. Go to `/orders` → My listings → Remove that listing. Then check Supabase Storage →
   `listing-photos` bucket → the folder for that listing should be gone too (cleanup worked).
6. Try uploading a non-image file or something over 5MB — you should get a clear inline error,
   not a crash.

## 6. Commit, push, merge

```bash
git add -A
git commit -m "Add real photo upload to Supabase Storage"
git push -u origin feature/image-upload
git checkout main
git merge feature/image-upload
git push origin main
```

## Honest scope note

- Background cleanup, stock-photo detection, and AI pricing suggestions from the original
  spec are **not** built here — those need an actual computer-vision model, which is a
  meaningfully bigger, separate branch (and one of the genuinely-hard-to-do-for-free pieces,
  since it needs either a paid vision API or self-hosted compute).
- If photo upload fails after the listing itself was created successfully, the listing still
  publishes — you just get an amber warning. There's no retry-upload UI yet; that's a natural
  small follow-up once you're editing existing listings.

## Next branch

`feature/chat` — buyer/seller messaging, using Supabase Realtime (free tier), so people can
actually negotiate on a listing instead of it being purely informational.
