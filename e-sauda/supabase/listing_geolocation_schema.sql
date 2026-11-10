-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- feature/listing-map: stores an approximate lat/lng for each listing's
-- seller-entered "area" (e.g. "Rohini Sector 13"), so ListingDetail can show
-- a real interactive map the way OLX does.
--
-- Deliberately area-level, not a precise pinned address: the coordinates are
-- resolved once, server-side-adjacent (in the Sell/EditListing form) from the
-- free-text location string the seller already types, via OpenStreetMap's
-- Nominatim geocoder. Nobody is dropping a pin on their front door, so exact
-- street-level privacy is preserved by construction, not by trying to fuzz an
-- exact address after the fact.
--
-- Prerequisite: supabase/listings_schema.sql (or schema.sql) already applied.

alter table public.listings
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

comment on column public.listings.latitude is
  'Approximate latitude for the seller-entered location/area string (see lib/geocoding.ts). Null for listings created before this feature, or if geocoding could not resolve the text.';
comment on column public.listings.longitude is
  'Approximate longitude for the seller-entered location/area string. Same nullability caveat as latitude.';
