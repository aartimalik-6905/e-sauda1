-- Run this in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- feature/razorpay-refund: closes the gap flagged in RAZORPAY_SETUP.md -- cancelling a
-- real-payment order used to just flip a database status with no real refund. This
-- adds the columns the refund Edge Function needs to track what's been refunded and
-- prevent double-refunding.
--
-- Prerequisites: supabase/razorpay_schema.sql and supabase/dispute_fee_schema.sql
-- must already be applied (this uses razorpay_payment_id, refund_amount, and
-- deducted_fee, which those two migrations added).

alter table public.vault_orders
  add column if not exists razorpay_refund_id text,
  add column if not exists refund_processed_at timestamptz;

-- No RLS change needed here -- these are just two more columns on a table whose
-- policies (from vault_schema.sql) already scope reads/writes to the buyer/seller.
-- The refund Edge Function writes these two columns using the service-role key
-- (bypassing RLS entirely), same reasoning as razorpay_payments in razorpay_schema.sql:
-- a refund record is only trustworthy if it can't be written by an ordinary user
-- pretending a refund happened when it didn't.
