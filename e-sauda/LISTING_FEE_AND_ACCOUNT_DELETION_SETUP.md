> **Note (Nov 2026):** e-Sauda is now a C2C classifieds platform with no escrow/Vault. Sections below that mention the Vault, orders, OTP handover, delivery or KYC are out of date. See `C2C_MIGRATION.md`.

# feature/real-listing-fee-and-account-deletion — setup guide

Two features, finishing what was checkpointed earlier this session.

## Part 1: Real listing-fee charging

Your Sell wizard has always displayed an "anti-bot fee" (₹1/₹10/₹25
depending on how many active listings you have in that category) — your
own Pricing page (from the legal-pages branch) honestly admits it was
never actually charged. This makes it real, using the exact same
trusted-payment pattern as Vault: a Cashfree order is created, Checkout
opens, and the listing can't actually be created without a server-side
verified payment to back it.

### What changed

- `createListing()` now requires a `CashfreeOrderId` — obtained by calling
  `payListingFee()` (new) first, which opens real Cashfree Checkout for
  the fee amount.
- The fee tier is computed **server-side**, from your actual active
  listing count in that category — never trusted from the client (same
  reasoning as the Vault purchase price).
- **The plain `INSERT` policy on `listings` was removed.** The only way to
  create a listing now is through a new database function,
  `create_listing_with_fee`, which verifies a real payment exists before
  inserting anything. This closes the exact gap that would otherwise let
  someone skip paying by calling `supabase.from('listings').insert()`
  directly instead of going through the Sell wizard.

### 1. Run the SQL migration

Requires `Cashfree_schema.sql` already applied (reuses its Cashfree
secrets). Then run `supabase/listing_fee_schema.sql` in the SQL Editor.

### 2. Deploy the two new Edge Functions

```bash
supabase functions deploy create-listing-fee-order
supabase functions deploy verify-listing-fee-payment
```

### 3. Test it

1. Start posting a new listing → get to the final step and hit publish →
   confirm a **real Cashfree Checkout modal** opens for the fee amount
   (₹1 if this is your first active listing in that category), not an
   instant publish like before.
2. Pay with the test card (`4111 1111 1111 1111`) → confirm the listing
   publishes normally afterward.
3. Check Supabase Table Editor → `listing_fee_payments` → confirm a row
   exists with `consumed_at` now set.
4. Post a **second** listing in the **same category** → confirm the fee
   is now ₹10, not ₹1 (tier scales with your real active count).
5. Close the Checkout modal without paying → confirm you're returned to
   the wizard with no error banner (treated as "changed their mind," same
   as the Vault buy flow).
6. As a sanity check on the security boundary: open your browser console
   and try `supabase.from('listings').insert({...})` directly with some
   fields → confirm it's rejected (no insert policy exists for this
   anymore) rather than silently succeeding.

## Part 2: Account deletion

Your Privacy Policy already promises "you may request deletion by
contacting us" — there was no actual mechanism behind that. Now there is,
on the Profile page's new "Danger zone" section.

### Why this is a soft delete, not a real `DELETE`

Several tables — `vault_orders.buyer_id`/`seller_id`, conversations,
messages — reference `auth.users` with `on delete cascade`. Actually
deleting the auth user would silently cascade-delete every historical
order/conversation the OTHER party is part of too — e.g. a seller's
completed-sale record vanishing because the buyer deleted their account
months later. That's a worse outcome than not offering deletion.

Instead, `delete-account` does three things:
1. **Blocks deletion** if you have any Vault order still `funded` (real
   money in active escrow) — you have to resolve that first.
2. **Bans the auth account indefinitely** (100 years) and randomizes its
   email/password — you can never log back in, but the row itself still
   exists, so cascading deletes never fire.
3. **Anonymizes the profile** — display name becomes "Deleted user," city
   cleared — and pulls down any active listings.

Historical transactions the other party is part of stay completely
intact; they'll just see "Deleted user" where your name used to be.

### 1. Run the SQL migration

Run `supabase/account_deletion_schema.sql` — just adds a `deleted_at`
column, no other schema dependencies.

### 2. Deploy the Edge Function

```bash
supabase functions deploy delete-account
```

### 3. Test it

1. Go to **Profile** → scroll to the red **"Danger zone"** section →
   click **"Delete my account"**.
2. Confirm the delete button stays disabled until you type `DELETE`
   exactly.
3. **With an active Vault order** (status `funded`) on that account →
   confirm deletion is refused with a clear message telling you to
   resolve it first.
4. Complete or cancel that order, then retry → confirm it now succeeds,
   you're logged out immediately, and redirected home.
5. Try logging back in with the same email/password → confirm it fails
   (the account is banned).
6. As the **other party** in a past completed transaction with the
   now-deleted account → confirm your order history still shows that
   transaction, just with "Deleted user" instead of their real name.
7. In Supabase Auth dashboard → find that user → confirm they show as
   banned, with a randomized `.invalid` email, not actually removed from
   the users list.

## Design notes

**Why the listing-fee RPC needed the plain INSERT policy removed, not
just added alongside a check.** RLS policies for the same operation
(INSERT) are OR'd together, not AND'd — so if the original "Users can
insert their own listings" policy had been left in place, a client could
simply bypass the new fee-gated RPC and use the plain insert instead,
completely defeating the point of charging a fee at all. This mirrors the
same lesson learned building `create_vault_order` earlier: any table
where "a real payment happened" needs to gate an insert must have no
other path into that table for ordinary roles.

**Why account deletion bans for 100 years instead of, say, 1 year.**
There's no real reason someone would want their "deleted" account to
un-ban itself later — this is meant to be permanent from the user's
perspective. A literal permanent ban isn't a supported duration format,
so 100 years is the practical equivalent.

**Why blocking on `funded` orders specifically, not all historical
orders.** A `completed` or `cancelled` order is finished — there's no one
left waiting on the deleted account for anything. A `funded` order has
real money sitting in escrow with a counterparty who still needs the
other person reachable (to arrange handover, confirm the OTP, or resolve
a cancellation) — deleting out from under that would strand their money
mid-transaction.

## Files touched in this branch

- `supabase/listing_fee_schema.sql` — new: `listing_fee_payments` table,
  `create_listing_with_fee` RPC, removes the plain listings INSERT policy.
- `supabase/functions/create-listing-fee-order/index.ts` — new.
- `supabase/functions/verify-listing-fee-payment/index.ts` — new.
- `src/lib/listingFee.ts` — new: `payListingFee()`.
- `src/lib/listings.ts` — `createListing()` now requires a
  `CashfreeOrderId` and calls the new RPC instead of a plain insert.
- `src/pages/Sell.tsx` — charges the real fee before creating the listing.
- `supabase/account_deletion_schema.sql` — new: `deleted_at` column.
- `supabase/functions/delete-account/index.ts` — new.
- `src/lib/account.ts` — new: `deleteAccount()`.
- `src/pages/Profile.tsx` — new "Danger zone" section with type-to-confirm
  deletion.

Verified in this session: `npm install`, `npx tsc --noEmit`, and `npm run
build` all pass clean with zero errors.
