-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- feature/account-deletion: lets a user actually delete their account, which your own
-- Privacy Policy already promised ("you may request deletion by contacting us") but
-- had no real mechanism behind it until now.
--
-- IMPORTANT DESIGN NOTE, read before assuming this does a literal `DELETE FROM
-- auth.users`: it deliberately does NOT hard-delete the auth user. Several tables in
-- this app -- vault_orders.buyer_id/seller_id, conversations/messages -- reference
-- auth.users with `on delete cascade`. If we actually deleted the row, cascading
-- deletes would silently destroy the OTHER party's transaction/chat history too --
-- e.g. a seller's completed sale record disappearing because the buyer deleted their
-- account six months later. That's a worse outcome than not offering deletion at all.
--
-- Instead, this is a "soft delete" / anonymization, done entirely in the
-- delete-account Edge Function: the auth user is banned (can never log in again) and
-- given a randomized email/password, the profile is scrubbed (name becomes "Deleted
-- user", city cleared), and their active listings are pulled down. Historical
-- transactions the *other* party is part of stay completely intact -- they'll just
-- see "Deleted user" instead of a name, exactly how most real platforms handle this.

alter table public.profiles add column if not exists deleted_at timestamptz;

-- No RLS change needed -- the Edge Function does all of this via the service-role key,
-- same as every other "only a trusted server-side process can do this" action already
-- in this app (razorpay_payments, reports status changes, etc.).
