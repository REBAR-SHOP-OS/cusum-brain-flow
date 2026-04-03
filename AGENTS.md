# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Rebar Shop OS ("Vizzy Web") is a React 18 + TypeScript SPA built with Vite 5, Tailwind CSS, and shadcn/ui. The backend is a remote Supabase instance (DB, Auth, Edge Functions, Storage) — no local backend or Docker is needed.

### Quick reference

| Action | Command |
|--------|---------|
| Install deps | `npm install` |
| Dev server | `npm run dev` (port 8080) |
| Lint | `npm run lint` |
| Test | `npm run test` |
| Build | `npm run build` |

See `package.json` `scripts` for the full list.

### Non-obvious notes

- The Vite dev server listens on `::` (all interfaces) port **8080**, configured in `vite.config.ts`.
- The `.env` file is committed with the Supabase anon key and URL. No additional secrets are required to start the frontend.
- Authentication uses Supabase Auth with email verification required for new accounts. Google and Apple OAuth are also configured but require external provider setup.
- The 203 Supabase Edge Functions (in `supabase/functions/`) are Deno-based and deployed to the remote Supabase project — they are not run locally.
- The `camera-intelligence/` directory is an optional Python/FastAPI microservice for shop-floor computer vision. It is not required for the main app.
- ESLint has ~2800+ pre-existing errors (mostly `no-explicit-any`); these are not blockers.
- Vitest has 6 pre-existing test failures; these are not caused by environment issues.
- Path alias `@` maps to `./src` (configured in both `vite.config.ts` and `vitest.config.ts`).
- Both `bun.lock`/`bun.lockb` and `package-lock.json` exist; use **npm** as the package manager (bun is not installed in the Cloud Agent VM).
