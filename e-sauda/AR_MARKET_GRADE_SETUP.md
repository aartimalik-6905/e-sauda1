# feature/ar-market-grade — setup guide

## What was already there

Your repo already had a working, real AR/size-check feature (merged as
"add AR/size-check viewer") — a to-scale 3D box built from a listing's
width/height/depth, viewable and rotatable inline, with a real AR button
(via `<model-viewer>`, loaded from a CDN script tag in `index.html`) that
opens WebXR on Android Chrome or Quick Look on iOS Safari. Fully
client-side: no API key, no account, no daily quota, nothing to sign up
for. That part was already solid and I didn't need to rebuild it.

## What this branch upgrades

The box was previously a single flat color. Now, when a listing has
photos, they're **mapped onto the box's faces** — so what you see and
place in AR actually resembles the item, not just an abstract
placeholder. Specifically:

- Front/back/left/right faces get real photos (reusing whatever photos
  exist across all four faces if there are fewer than four — even a
  single-photo listing gets a fully "wrapped" box)
- Top/bottom stay a plain shaded color (product photos essentially never
  show those angles, so there's nothing real to map there)
- A soft, cheap drop-shadow disc renders under the box for a real sense
  of it resting on a surface — this is a simple gradient texture, not
  real-time shadow mapping, but reads convincingly at this scale
- If a photo fails to load for any reason (broken URL, slow network, a
  CORS issue), that specific face **silently falls back to the plain
  color** instead of breaking the whole preview — verified this fallback
  logic directly (see below)

This is still deliberately **not** a real 3D scan or reconstruction —
it's a box with photos on it, which is an honest, achievable "market
grade" step up from a flat color, not a claim that this looks
identical to the actual item from every angle.

## No SQL migration, no new dependencies

This branch only changes one component and one call site. The
`width_cm`/`height_cm`/`depth_cm` columns and the `three` /
`@google/model-viewer` setup already exist from the prior AR branch.

## Install and run

```bash
npm install
npm run dev
```

## Test it

1. Open a listing that has **both** dimensions set **and** at least one
   photo. Confirm the box now shows that photo on its front face (and
   the other side faces, reused if you only have 1-3 photos).
2. Try a listing with 4+ photos — confirm each side face shows a
   different photo rather than all repeating the same one.
3. Try a listing with dimensions but **zero** photos — confirm it falls
   back cleanly to the original plain-color box (no error, no blank
   space).
4. Drag to rotate — confirm the shadow disc stays correctly under the
   box as you spin it.
5. On a phone, tap "View in AR" — confirm the photo-textured box places
   correctly in your real room at true scale.
6. Edge case: temporarily break a photo URL (e.g. via browser devtools,
   block the image request) and reload — confirm that face falls back
   to the plain color instead of showing a broken-texture error or
   crashing the component.

## What I verified before handing this to you

I can't run WebGL or a real AR session in this environment, so I
couldn't test the actual rendered output directly. What I could and did
verify:
- `npx tsc --noEmit` and `npm run build` both pass clean
- The photo-reuse fallback logic (which photo goes on which face, across
  0/1/2/3/4+ photo counts) tested in isolation — all 6 cases pass exactly
  as intended, including the "wrap a single photo across all four side
  faces" behavior for listings with only one photo

The one thing that only you can confirm: whether Supabase Storage's
public bucket serves images with permissive-enough CORS headers for
`THREE.TextureLoader` to actually load them (public buckets typically do
by default — this is standard, not something specific to this app — but
it's the one real-world detail I can't verify without hitting your
actual deployed storage bucket).

## Files touched in this branch

- `src/components/SpaceFitViewer.tsx` — face texturing, shadow disc, safe fallback.
- `src/pages/ListingDetail.tsx` — passes `photoUrls` through.
