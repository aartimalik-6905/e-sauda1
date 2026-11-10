# AR / size-check viewer setup

Lets buyers see a to-scale 3D box of an item's real-world dimensions on the listing
page, and place it in their own room via AR on a phone. Fully client-side — no
external account, no API key, no server secret, and therefore **no quota to hit**
(unlike the Shiprocket/DigiLocker work, which needed real third-party accounts).

## How it works

1. Sellers optionally enter width/height/depth (cm) in Sell → Details or
   EditListing.
2. Those are stored on `public.listings` (`width_cm`, `height_cm`, `depth_cm`) and
   mapped back into `Listing.widthCm/heightCm/depthCm`. `Listing.ar` is computed —
   `true` only when all three are present.
3. On the listing page, `SpaceFitViewer` builds a `THREE.BoxGeometry` scaled to those
   dimensions, exports it to a GLB in-browser with `GLTFExporter`, and hands the
   resulting blob URL to the `<model-viewer>` web component (loaded from a CDN in
   `index.html`), which renders the interactive 3D view and the real AR button
   (Scene Viewer on Android, Quick Look on iOS/Safari).

## 1. Run the database migration

Supabase Dashboard → SQL Editor → New query → paste and run:
`supabase/ar_dimensions_schema.sql`

This adds three nullable, additive columns to `listings`. No RLS changes needed —
the existing policies already cover them.

## 2. Install the new dependency

```bash
npm install
```

`three` and `@types/three` were added to `package.json`. `@google/model-viewer`
is **not** an npm dependency — it's loaded straight from a CDN via a `<script>`
tag already added to `index.html`, so there's nothing else to install for it.

## 3. Verify locally

```bash
npm run build     # tsc -b && vite build — confirms types and the production bundle
npm run dev        # then open a listing you've added dimensions to
```

On desktop you'll see the interactive 3D box (drag to rotate). On a phone, open the
same listing and tap "View in AR" to place it in your actual room.

## Notes / limitations

- The box is a plain scaled cuboid, not a scan of the real item — it answers "will
  this fit through my door / in this corner", not "what does this exactly look
  like". That's a deliberate scope cut to keep this fully free and client-side.
- Dimensions are all-or-nothing: if any one of width/height/depth is missing, the
  viewer section doesn't render for that listing.
- `<model-viewer>`'s AR button only appears on AR-capable devices/browsers; on
  unsupported ones you still get the interactive 3D preview.
