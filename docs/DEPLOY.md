# Deploying Throne

Throne is a static PWA: everything runs in the browser and data lives on the device (IndexedDB). Any static host works.

## GitHub Pages (set up)

`.github/workflows/pages.yml` builds `app/` with `VITE_BASE=/<repo>/`, copies `index.html` to `404.html` (so deep links such as `/throne/characters/1` open the app) and deploys on every push to `main`.

One-time, in the repository on github.com:
1. Settings → General → Danger Zone → Change visibility → Public (Pages is free for public repositories).
2. Settings → Pages → Build and deployment → Source: **GitHub Actions**.
3. Actions → "Deploy to GitHub Pages" → Run workflow (or push to `main`).

The site is then at `https://<owner>.github.io/throne/`. On iPhone: open it in Safari, Share → Add to Home Screen.

The workflow skips itself while the repository is private.

## Other hosts

Build from `app/` with `npm ci && npm run build`, publish `app/dist`, leave `VITE_BASE` unset (serves from `/`).
- **Cloudflare Pages / Netlify:** `app/public/_redirects` already sends every path to `index.html`.
- **Vercel:** add a rewrite of `/(.*)` to `/index.html`.

## Checks before a release
- `npx tsc -b` and `npm run build` pass (CI does this on every PR).
- Open a deep link directly (for example `/throne/notes`) and reload: the app should load, not a host error page.

## Sync (Supabase)

The app talks to the Supabase project `throne` with the publishable key in `app/src/lib/supabaseConfig.ts` (safe in client code; row-level security protects each user's data). One-time settings in the Supabase dashboard for the deployed site:
1. Authentication → URL Configuration → **Site URL**: the deployed address (for example `https://<owner>.github.io/throne/`), and add it under Redirect URLs. Otherwise the "confirm your email" link opens `localhost`.
2. The built-in email sender only delivers to members of the Supabase organisation and is rate-limited. That is fine for personal use; for other people signing up, add a custom SMTP provider (Authentication → Emails → SMTP).
