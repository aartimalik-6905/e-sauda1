# feature/auth — setup steps

## 1. Create the branch

```bash
git checkout main
git pull
git checkout -b feature/auth
```

## 2. Create a free Supabase project

1. Go to https://supabase.com → sign up (free, no card).
2. Click **New project**. Pick any name/region, set a database password (save it somewhere).
3. Wait ~2 minutes for it to provision.

## 3. Get your API keys

1. In your new project, go to **Project Settings → API**.
2. Copy the **Project URL** and the **anon public** key.
3. In your `e-sauda` folder, copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
4. Paste your values into `.env.local`:
   ```
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```
   `.env.local` is already in `.gitignore` — it will never get committed or pushed.

## 4. Create the database table

1. In Supabase, open **SQL Editor → New query**.
2. Paste in the entire contents of `supabase/schema.sql` from this project.
3. Click **Run**. You should see "Success. No rows returned."

This creates a `profiles` table (display name, city, trust score, verified flag), locks it
down with row-level security so users can only edit their own profile, and sets up a trigger
so a profile row is created automatically whenever someone signs up.

## 5. (Optional but recommended) Turn off email confirmation for local testing

By default Supabase requires clicking a confirmation link before login works. That's correct
for production, but annoying while developing. To skip it for now:

1. **Authentication → Providers → Email**.
2. Turn off **Confirm email**.
3. Turn it back on before you actually launch to real users.

## 6. Install the new dependency and run it

```bash
npm install
npm run dev
```

## 7. Try it

1. Go to `/signup`, create an account.
2. If you turned off email confirmation, you're logged in immediately — check the navbar,
   it should now show your initial instead of "Log in / Sign up".
3. Try visiting `/sell`, `/orders`, `/vault`, or `/profile` while logged out (in an incognito
   window) — you should get redirected to `/login`.
4. Log out from the profile dropdown, confirm you're bounced back to logged-out state.

## 8. Commit and push

```bash
git add -A
git commit -m "Add Supabase auth: signup, login, protected routes, profile context"
git push -u origin feature/auth
```

Then merge it into `main` (via a GitHub pull request, or directly):
```bash
git checkout main
git merge feature/auth
git push
```

## What changed in this branch

- `src/lib/supabase.ts` — the Supabase client, reads keys from `.env.local`
- `src/context/AuthContext.tsx` — tracks the logged-in user/session app-wide, exposes
  `signUp`, `signIn`, `signOut`
- `src/pages/Login.tsx`, `src/pages/Signup.tsx` — new pages
- `src/components/RequireAuth.tsx` — redirects to `/login` if you're not signed in
- `src/App.tsx` — `/sell`, `/orders`, `/vault`, `/profile` are now wrapped in `RequireAuth`
- `src/components/Navbar.tsx` — shows Login/Sign up when logged out, your real name + trust
  score + a working Log out button when logged in
- `src/pages/Profile.tsx` — now shows your real name, city, trust score, and verified status
  (listing/order counts are still placeholders until the next branch adds the database)
- `supabase/schema.sql` — run this once in your Supabase project

## Next branch

`feature/listings-db` — replace `src/data/listings.ts` mock data with a real `listings` table,
so listings you post in `/sell` actually show up in `/browse`, tied to your real user id.
