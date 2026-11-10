-- Run this ONLY if phone_otp_schema.sql was already applied to your Supabase
-- project. Rolls back the mandatory-mobile-verification feature.

drop table if exists public.phone_otps;

alter table public.profiles
  drop column if exists phone_number,
  drop column if exists phone_verified;