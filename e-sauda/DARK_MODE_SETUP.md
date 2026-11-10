# feature/dark-mode — setup guide

A real light/dark toggle, with no per-file changes needed across the app
— the trick is redefining the *existing* color tokens (`cream`, `ink`,
`forest`, `clay`) to read from CSS variables instead of fixed hex values,
so every one of the ~26 files already using `bg-cream`, `text-ink`,
`bg-forest`, etc. automatically adapts.

## What changed, and why no component files needed editing

- `tailwind.config.js` — each color (`cream`, `cream-dark`, `forest`,
  `forest-light`, `clay`, `clay-light`, `ink`) now resolves via
  `rgb(var(--color-x) / <alpha-value>)` instead of a hardcoded hex value.
- `src/index.css` — defines the actual R G B values for both `:root`
  (light) and `.dark` (dark). **This is where the real color decisions
  live now**, not in the Tailwind config.
- `src/hooks/useTheme.ts` + `src/components/ThemeToggle.tsx` — a sun/moon
  button (in the navbar, visible whether logged in or not) that toggles a
  `dark` class on `<html>` and remembers the choice in `localStorage`.
- `index.html` — a small inline script that reads the saved preference
  (or falls back to the OS-level `prefers-color-scheme`) and sets the
  `dark` class **before React even mounts** — without this there'd be a
  visible flash of the light theme for a split second on every page load
  for anyone using dark mode.

No SQL migration, no new dependencies, no per-page changes.

## Test it

1. `npm run dev`, open the app → click the sun/moon icon in the navbar →
   confirm the whole app switches — backgrounds, text, buttons, the clay
   accent color — not just one section.
2. Refresh the page → confirm it stays in whichever theme you picked (not
   just for the session — actually persisted).
3. Open dev tools → Application → Local Storage → confirm a `theme` key
   is set to `"light"` or `"dark"`.
4. Clear that local storage key, then set your **OS** to dark mode and
   reload → confirm the app opens in dark mode automatically (falls back
   to system preference when there's no saved choice yet).
5. With dark mode on, do a hard refresh a few times → watch closely for
   any flash of white/light background before it settles into dark — there
   shouldn't be one (that's what the inline script in `index.html` is for).
6. Click through several different pages (Browse, a listing detail,
   Profile, Vault, the legal pages) → confirm the theme is consistent
   everywhere, not just the homepage.

## Known limitation — read before assuming this is pixel-perfect everywhere

**Borders and subtle overlays using Tailwind's built-in `black` with
opacity (`border-black/5`, `border-black/10`, `bg-black/5`,
`hover:bg-black/5`, etc.) do NOT invert with the theme.** This pattern
shows up in roughly 22 files across the app — card borders, dividers,
hover states. In dark mode, a "5% black" border sitting on a dark
background is nearly invisible, so some card edges and dividers will look
softer/washed-out in dark mode than they do in light mode. This isn't a
bug so much as a scope boundary: fixing it properly means introducing a
new semantic token (e.g. a `border` color that itself reads from a CSS
variable, the same technique used for `cream`/`ink`/etc. here) and
swapping every `border-black/X`/`bg-black/X` usage across those ~22 files
to use it instead — a real, separate follow-up feature, not a quick
addition to this one. Flagging this now rather than letting you discover
it and wonder if the whole feature is broken — the core theming (which is
most of what you'll notice) works correctly; this is a secondary polish
item on top of it.

## Design notes

**Why colors are redefined via CSS variables instead of adding `dark:`
variants to every component.** With ~26 files already using these color
classes directly, adding a `dark:bg-forest-900` (or similar) next to every
single existing color class would mean touching every one of those files,
likely hundreds of individual edits, with real risk of missing some and
ending up with an inconsistent half-dark app. Redefining the token itself
once, in one place, means every existing usage inherits the fix for free.

**Why the inline script in `index.html` duplicates logic from
`useTheme.ts` instead of just letting the hook handle everything.** React
can't run anything until the JS bundle loads and mounts, which happens
after the browser has already painted the initial HTML/CSS once. If the
theme were only ever set inside a `useEffect`, a dark-mode user would see
a flash of the light theme on every load, for as long as it takes React to
mount and run that effect. The inline script runs synchronously, before
any paint happens at all, closing that gap -- `useTheme.ts`'s
`getInitialTheme()` then just reads back the class the script already
set, keeping the two in sync rather than each deciding independently.

## Files touched in this branch

- `tailwind.config.js` — color tokens now reference CSS variables;
  `darkMode: 'class'` added.
- `src/index.css` — actual light/dark color values defined here.
- `index.html` — flash-prevention inline script.
- `src/hooks/useTheme.ts` — new: theme state, persistence, toggling.
- `src/components/ThemeToggle.tsx` — new: the sun/moon button.
- `src/components/Navbar.tsx` — added the toggle, visible regardless of
  login state.

Verified in this session: `npm install`, `npx tsc --noEmit`, and `npm run
build` all pass clean with zero errors.
