-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Adds the real-world size fields that power the "View in your space" AR/size-check
-- feature on the listing detail page. Purely additive — safe to re-run, and existing
-- rows just get NULLs (which mapRow()/SpaceFitViewer already treat as "no AR available").

alter table public.listings
  add column if not exists width_cm numeric check (width_cm is null or width_cm > 0),
  add column if not exists height_cm numeric check (height_cm is null or height_cm > 0),
  add column if not exists depth_cm numeric check (depth_cm is null or depth_cm > 0);

-- No RLS changes needed: the existing "viewable by everyone" / "update own listings"
-- policies on public.listings already cover these new columns.
