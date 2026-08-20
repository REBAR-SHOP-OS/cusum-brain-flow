# Client hardening (XSS, secrets, session)

## Verified in repo

- No `SERVICE_ROLE` or `service_role` string in `src/` TypeScript — the app uses **publishable/anon** key only via `VITE_SUPABASE_*` in [`src/integrations/supabase/client.ts`](../../src/integrations/supabase/client.ts).
- Rich text paths should keep using **DOMPurify** (or equivalent) before `dangerouslySetInnerHTML`.

## Session storage

- Supabase session is persisted in **localStorage**. Any XSS that runs in the origin can read tokens.
- Mitigations: strict CSP where hosting allows it, sanitize HTML, minimal third-party scripts, Subresource Integrity for CDNs.

## Content-Security-Policy (CSP)

- This Vite app uses **inline JSON-LD** in `index.html` and may use HMR in dev — a **strict** default CSP is not applied in-repo to avoid breaking Lovable/Vite dev.
- **Production recommendation:** set CSP headers on the CDN/host (e.g. `default-src 'self'; script-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co ...`) and tune `script-src` for any required inline hashes if JSON-LD must stay inline, or move JSON-LD to a static file.

## Dependency audit

- Run periodically: `npm audit` and upgrade critical CVEs.
