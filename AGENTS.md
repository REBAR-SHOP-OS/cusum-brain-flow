# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Vizzy Web (Rebar Shop OS) is a React 18 + TypeScript SPA built with Vite, backed by a remote Supabase Cloud instance (PostgreSQL, Auth, Edge Functions, Storage). There is no local database or Docker dependency for the frontend.

### Running services

| Service | Command | Port | Notes |
|---|---|---|---|
| **Dev server** | `npm run dev` | 8080 | Vite dev server with HMR. Binds to `::` (all interfaces). |

The backend is a remote Supabase Cloud project (`uavzziigfnqpfdkczbdo.supabase.co`). Credentials are in `.env` (already committed). No local Supabase CLI/Docker setup is needed to develop the frontend.

### Key commands

See `package.json` scripts:

- **Lint:** `npm run lint` (ESLint — many pre-existing warnings/errors for `no-explicit-any` and `exhaustive-deps`)
- **Test:** `npm run test` (Vitest — 119 pass, 6 pre-existing failures)
- **Build:** `npm run build` (Vite production build)
- **Dev:** `npm run dev` (Vite dev server on port 8080)

### Gotchas

- The `.env` file is committed with Supabase anon key and URL. The `.env.example` uses `VITE_` prefixed vars; `.env` has both prefixed and unprefixed variants.
- `sharp` is listed as a dependency (for `vite-plugin-image-optimizer`). On some platforms `npm install` may need to rebuild native modules.
- The 6 pre-existing test failures are in `extractService.test.ts` (Supabase auth mock issues), `useCEODashboard.test.ts` (schema limitation tests that are now passing — tests are outdated), `useOrders.test.ts` (cache invalidation assertion), and `realtimeScoping.test.ts` (channel scoping assertion). These are not regressions.
- Build output is large (~7 MB main chunk) with a `chunkSizeWarningLimit` of 8000 in `vite.config.ts`.
- Auth requires a valid Supabase account. The login page is at `/login`. OAuth (Google, Apple) and email/password flows are supported.
