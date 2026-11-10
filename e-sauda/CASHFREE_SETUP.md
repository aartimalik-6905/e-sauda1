# Cashfree Payment Gateway Setup — e-Sauda Listing Fees

This migration replaces Razorpay for seller listing fees while preserving the existing
fee tiers: ₹1 for the first active listing in a category, ₹10 for the second, and ₹25
for the third or later active listing in that category.

The legacy Razorpay/Vault SQL schema is intentionally retained because existing
historical database functions may depend on it. The new listing-fee checkout does not
use Razorpay.

## Integration overview

1. The authenticated seller starts publishing a listing.
2. The frontend requests an order from `create-listing-fee-order`.
3. The Edge Function derives the fee from the seller's active listing count, binds the
   payment to the seller, category and pre-generated listing UUID, then creates the
   Cashfree order using server-side credentials.
4. Cashfree Hosted Web Checkout opens in production mode using `payment_session_id`.
5. After checkout returns and media uploads complete, the frontend calls
   `verify-and-publish-listing` with the listing draft.
6. The `verify-and-publish-listing` function fetches the order directly from Cashfree,
   marks the local payment PAID only when Cashfree reports `order_status = PAID` and
   all order metadata, amount and currency match.
7. The backend invokes `create_listing_with_cashfree_fee` only when the seller,
   listing UUID, category and verified PAID Cashfree order match. The payment row is
   consumed atomically with listing creation.
8. `cashfree-webhook` provides a signed, idempotent backup confirmation path.

## Required Supabase Edge Function secrets

Set these in Supabase Project Settings → Edge Functions → Secrets, or using the CLI:

```bash
supabase secrets set \
  CASHFREE_APP_ID="your-production-app-id" \
  CASHFREE_SECRET_KEY="your-production-secret-key" \
  CASHFREE_WEBHOOK_SECRET="your-cashfree-webhook-signing-secret" \
  CASHFREE_API_VERSION="2025-01-01" \
  APP_URL="https://your-production-domain.example"
```

`CASHFREE_WEBHOOK_SECRET` can be set to the webhook signing secret configured for
the Cashfree webhook. If your Cashfree account uses the API Secret Key for webhook
signature generation, set it to the same value as `CASHFREE_SECRET_KEY`.

The following Supabase-provided secrets must also be available to Edge Functions:
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Supabase normally
provides these in the Edge Function environment; do not put the service-role key in
the frontend.

## Database migration

Apply the following SQL in Supabase Dashboard → SQL Editor, after the existing
listing-fee, geolocation and media migrations have been applied:

```text
supabase/cashfree_listing_fee_schema.sql
```

This migration creates the Cashfree payment ledger and the secure
`create_listing_with_cashfree_fee` RPC. It is additive and does not delete the old
Razorpay/Vault tables.

## Deploy Edge Functions

```bash
supabase functions deploy create-listing-fee-order
supabase functions deploy verify-and-publish-listing
supabase functions deploy cashfree-webhook
supabase functions delete verify-listing-fee-payment
```

`supabase/config.toml` disables JWT verification only for the public Cashfree webhook.
The webhook itself authenticates requests using Cashfree's HMAC signature.

## Cashfree Dashboard configuration

1. Create/activate a Cashfree Payments merchant account.
2. Generate the Production App ID and Secret Key.
3. Whitelist the production website domain in Cashfree.
4. Configure a payment webhook pointing to:
   `https://YOUR_PROJECT_REF.supabase.co/functions/v1/cashfree-webhook`
5. Subscribe to payment success events (at minimum `PAYMENT_SUCCESS_WEBHOOK`).
6. Configure the webhook signing secret and set `CASHFREE_WEBHOOK_SECRET` accordingly.
7. Confirm the Cashfree merchant account is approved for production transactions.

## Environment and mode

- Hosted Checkout is initialized with `mode: "production"`.
- The server uses `https://api.cashfree.com/pg`.
- The API version defaults to `2025-01-01`.
- No Cashfree secret is exposed to the browser.
- The customer enters a 10-digit Indian mobile number during checkout setup because
  Cashfree Create Order requires customer phone details and the current profile model
  does not store a phone number.

## Test and launch checklist

- [ ] Apply `cashfree_listing_fee_schema.sql`.
- [ ] Set all Edge Function secrets.
- [ ] Deploy all three Edge Functions.
- [ ] Configure the Cashfree webhook URL and event subscriptions.
- [ ] Whitelist the deployed site domain in Cashfree.
- [ ] Verify first/second/third listing fees are ₹1/₹10/₹25.
- [ ] Test a successful payment and confirm the listing is created only after server verification.
- [ ] Test a failed, cancelled and pending payment; none may publish a listing.
- [ ] Replay a webhook and verify it does not duplicate or republish a listing.
- [ ] Test an order belonging to a different seller/listing; verification must reject it.
- [ ] Confirm a second payment attempt for an already-paid listing is not created.
- [ ] Confirm production keys are configured only in Supabase Edge Function secrets.

## Important scope note

This code uses production Cashfree endpoints and production checkout mode as requested.
Do not test with real money until Cashfree has activated the production account and you
have completed the full checklist. The integration cannot be fully live-tested without
valid merchant credentials, a deployed Supabase project, a whitelisted domain and a
configured webhook.
