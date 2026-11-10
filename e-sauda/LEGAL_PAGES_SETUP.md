> **Note (Nov 2026):** e-Sauda is now a C2C classifieds platform with no escrow/Vault. Sections below that mention the Vault, orders, OTP handover, delivery or KYC are out of date. See `C2C_MIGRATION.md`.

# feature/legal-pages — setup guide

Six pages required for Cashfree's "Business website details" activation
step (the second approval gate, separate from KYC, needed before you get
live-mode keys). No SQL, no Edge Functions -- pure frontend.

## Before this goes live: fill in the placeholders

Every page has `[BRACKETED PLACEHOLDERS]` for real details -- your legal
name, address, support email/phone. **Fill these in with the exact same
name/details you gave Cashfree during KYC** -- a mismatch here is a
realistic reason the website-activation step gets kicked back for
correction.

Search each file in `src/pages/legal/` for `[` to find every placeholder
that needs your real information:
- `Terms.tsx` — legal name, city/state, support email
- `Privacy.tsx` — support email (used twice)
- `RefundPolicy.tsx` — support email
- `ShippingPolicy.tsx` — support email
- `ContactUs.tsx` — email, phone, hours, registered address
- `Pricing.tsx` — support email

## Two honesty fixes made along the way

While writing these, I found two things in the existing app that
overclaim compared to what's actually built -- fixing both, since a real
legal Terms page can't sit next to a footer that contradicts it:

1. **Footer's "Delivery partners: Rapido, Uber, Dunzo"** -- there's no
   real partnership with any of these; delivery is still fully simulated
   (confirmed in `delivery_schema.sql`'s own honest-scope note from
   earlier). Replaced that column with a real **Legal** links column.
2. **Footer's "Safe meet zones"** and **"DigiLocker verification"** (as an
   unqualified claim) -- neither exists as a real feature yet (the
   "Verify with DigiLocker" button on Profile has no handler at all).
   Replaced "Safe meet zones" with "Report & block" (both real, shipped
   features), and softened "DigiLocker verification" to "(coming soon)".

## Design notes

**Why Pricing states the anti-bot listing fee isn't actually charged.**
Checked `Sell.tsx`: the "Anti-bot fee: ₹1/₹10/₹25" shown in the posting
wizard has no Cashfree call anywhere near it -- it's a displayed number
with no real payment collected. Stating otherwise on a real Pricing page
would be a false claim, exactly the kind of thing a payment-compliance
reviewer might specifically check. Worth deciding, separately from this
feature, whether to actually start charging that fee or remove the
display until it's real -- right now it says one thing and does another.

**Why Refund Policy states a specific "5-7 business days" instead of
vaguer language.** Vague refund timelines ("at our discretion", no
timeframe at all) are a commonly-cited, specific rejection reason for
Cashfree's website activation review. 5-7 business days is standard
Indian bank/UPI refund processing time and matches how the real refund
system (feature/Cashfree-refund) actually behaves -- refunds are
initiated immediately on cancellation, so this policy accurately
describes what already happens, not an aspirational promise.

**Why Shipping Policy doesn't hide that delivery is experimental.**
Same reasoning as the footer fix -- a Shipping Policy that implied a real
courier partnership would directly contradict reality the moment anyone
tried to use that feature, which is worse for trust (and compliance) than
being upfront that it's not live yet.

## Files touched in this branch

- `src/components/LegalLayout.tsx` — new: shared wrapper for consistent
  styling across all six pages.
- `src/pages/legal/Terms.tsx` — new.
- `src/pages/legal/Privacy.tsx` — new.
- `src/pages/legal/RefundPolicy.tsx` — new.
- `src/pages/legal/ShippingPolicy.tsx` — new.
- `src/pages/legal/ContactUs.tsx` — new.
- `src/pages/legal/Pricing.tsx` — new.
- `src/App.tsx` — added six public routes.
- `src/components/Footer.tsx` — added a real Legal links column; fixed
  the two overclaiming items described above.

Verified in this session: `npm install`, `npx tsc --noEmit`, and `npm run
build` all pass clean with zero errors.
