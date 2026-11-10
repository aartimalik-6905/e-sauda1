> **Note (Nov 2026):** e-Sauda is now a C2C classifieds platform with no escrow/Vault. Sections below that mention the Vault, orders, OTP handover, delivery or KYC are out of date. See `C2C_MIGRATION.md`.

# e-Sauda — starter (UI pass)

This is a working React + TypeScript + Tailwind app that reproduces the UI from your
screenshots: Home, Browse (with filters), Sell (4-step wizard), Orders, Vault, and Profile.
Everything is wired up and clickable — routing, filters, the sell wizard's local state — but
data is currently in-memory (`src/data/listings.ts`), not a real backend. That's on purpose:
you said you'd build features branch by branch, and the backend belongs to those branches.

## Run it

```bash
npm install
npm run dev
```

Then open the local URL Vite prints (usually http://localhost:5173).

## File map

```
e-sauda/
  index.html
  package.json
  vite.config.ts
  tailwind.config.js
  src/
    main.tsx              # app bootstrap + router
    App.tsx                # route table
    index.css              # Tailwind entry
    types.ts                # Listing / User / Category types
    data/listings.ts        # mock data — replace with real API calls later
    components/
      Navbar.tsx
      Footer.tsx
      ListingCard.tsx
    pages/
      Home.tsx
      Browse.tsx
      Sell.tsx
      Orders.tsx
      Vault.tsx
      Profile.tsx
```

## Suggested branch order

1. `feature/auth` — real login/signup (email+password or phone OTP via a free-tier auth
   provider like Supabase Auth or Firebase Auth — both have generous free tiers, no card
   required to start).
2. `feature/listings-db` — swap `src/data/listings.ts` for real reads/writes against a
   database (Supabase Postgres free tier is a solid fit — it also gives you auth + storage
   in one place).
3. `feature/image-upload` — real photo upload (Supabase Storage or Cloudinary free tier).
4. `feature/chat` — buyer/seller messaging (Supabase Realtime or Firebase Realtime DB, both
   free-tier).
5. `feature/escrow-payments` — see the honest note below before starting this one.
6. `feature/delivery` — logistics integration.
7. `feature/ai-search` / `feature/ai-pricing` / `feature/voice-listing` — see note below.

## An honest note on "free, no API keys" for some of these features

Most of the UI and CRUD-style features (auth, database, chat, image upload, filters, search)
can genuinely be built for free using generous free tiers (Supabase/Firebase/Cloudinary all
have real free plans). I've pointed at those above.

A few things in your spec can't be "free and production-ready" at the same time, and I'd
rather tell you that now than have you build toward a dead end:

- **Escrow payments holding real money** — this requires a registered
  business entity, KYC, and a payment gateway account; it is not something that runs for
  free or without a real account, because it's moving real money. You can build a **realistic
  mock** of the vault/escrow UI and status flow (which the Sell/Vault pages already do) and
  swap in a real payment gateway later once you're ready to register one.
- **Real SMS OTP delivery (Twilio/Msg91)** — has a free trial credit, not unlimited free
  usage. Email-based OTP (via a free-tier provider) is a genuinely free alternative for
  development.
- **Government DigiLocker verification** — requires registering as an approved requester
  with the government; not something you can wire up casually. A mock "Verified" toggle
  (as built into the Profile page) is the realistic stand-in until you pursue that
  registration.
- **Computer-vision background removal / stock-photo detection / ASR voice listing** — free
  open-source models exist (e.g. running your own background-removal or Whisper-based speech
  recognition model), but "free" here means self-hosting compute, which has real limits on a
  free hosting tier. These are good candidates for a later branch once the core app is solid.

None of this blocks you from shipping a real, working local marketplace app — it just means
the "bank-grade escrow" and "government ID verification" pieces will start as clearly-labeled
mocks until you're ready to register real accounts for them.

## Git workflow (matches what you described)

```bash
git init
git add -A
git commit -m "UI pass: home, browse, sell, orders, vault, profile"
git checkout -b feature/auth
# ...build the feature...
git commit -am "Add auth"
git checkout main
git merge feature/auth
```


## Cashfree listing-fee payments

See [`CASHFREE_SETUP.md`](./CASHFREE_SETUP.md) for the Cashfree Hosted Checkout migration, Supabase secrets, webhook setup, database migration and deployment steps.
