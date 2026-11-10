# Moving e-Sauda from escrow ("Sauda Vault") to C2C classifieds

## What changed

- **No in-app purchase.** The "Buy with Vault" button, the Vault page, My orders, OTP
  handover, delivery estimates, meetup planner and PDF receipts are gone. Buyers chat with
  the seller and pay them directly in person.
- **Cashfree for listing fees.** The seller pays the listing fee (₹1 / ₹10 / ₹25) when
  publishing. Buyers pay e-Sauda nothing.
- **Policies rewritten:** About, Terms, Privacy, Pricing, Refund, Cancellation, Shipping,
  Contact. "Seller onboarding & KYC" is replaced by a **Safety tips** page at `/safety`.
- **Chat warnings** now flag OTP requests, advance-payment requests, UPI IDs and links. Phone
  numbers are no longer flagged (people need them to meet).
- **Ratings** moved from vault orders to chats: once a listing is marked **sold**, either
  person in a chat about it can rate the other (one rating each per chat).
- **Home, Help, Footer, Navbar, chatbot prompt, meta tags** rewritten with no escrow wording.

## Deploy steps

1. Run `supabase/c2c_migration.sql` in the Supabase SQL editor. It **drops** `vault_orders`,
   `deliveries`, `meetups` and `razorpay_payments`, so export anything you want to keep first.
2. Redeploy the edge functions that changed:
   ```
   supabase functions deploy chat-assistant
   supabase functions deploy delete-account
   ```
3. Delete the old purchase functions (see `LEGACY_VAULT_PAYMENT_NOTES.md`).
4. Deploy the frontend (Vercel). Do not re-run the old `vault_schema.sql`, `delivery_schema.sql`,
   `meetup_schema.sql` or `dispute_fee_schema.sql` files on this database.

## Known limits

- Ratings are not tied to one specific buyer: any person who chatted about a sold listing can
  rate the seller, and the seller can rate any of them. Tighten this later by letting the
  seller pick who they sold to.
- Meetup confirmation and no-show reporting are not built yet (the old meetup feature was tied
  to vault orders and was removed).
- Older `*_SETUP.md` files and `TESTING_GUIDE.md` still describe the Vault flow and are out of date.
