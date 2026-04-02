# Audit Fix Changelog

## 2026-04-02

### Critical hardening
- Switched `supabase/config.toml` to secure defaults: `verify_jwt = true` for protected functions, `false` only for explicitly public/webhook/internal-only functions with alternative protections.
- Removed hardcoded SEMrush key and enforced `SEMRUSH_API_KEY` env usage in `supabase/functions/semrush-api/index.ts`.
- Added signed, expiring public quote tokens:
  - New helper: `supabase/functions/_shared/publicQuoteToken.ts`
  - `quote-public-view` now requires/validates token (`view` scope).
  - `send-quote-email` now:
    - Generates signed public link token for `send_quote` emails.
    - Requires token for unauthenticated `accept_and_convert` (`accept` scope).
    - Requires token for unauthenticated `send_quote_copy` (`copy` scope).
    - Restricts acceptance statuses and blocks expired quotes.
  - Frontend `src/pages/AcceptQuote.tsx` now reads `?token=...` and sends it for view/accept/copy calls.
- Hardened SSRF path in `supabase/functions/vizzy-glasses-webhook/index.ts`:
  - Rejects non-HTTPS URLs.
  - Blocks localhost/private/internal/metadata hosts.
  - Optional allowlist via `GLASSES_ALLOWED_IMAGE_HOSTS`.
  - Enforces size limits and content-type checks.
- Hardened shared request handling in `supabase/functions/_shared/requestHandler.ts`:
  - Invalid JSON now returns 400.
  - 500 responses now return generic internal error message (no raw error leakage).
- Removed query-string API-key auth in `supabase/functions/mcp-server/index.ts` (headers only).
- Locked down smoke tests:
  - `internalOnly: true` on `supabase/functions/smoke-tests/index.ts`.
- Fixed edge compile blockers:
  - Removed duplicate declarations in:
    - `supabase/functions/website-speed-audit/index.ts`
    - `supabase/functions/website-health-check/index.ts`

### RLS hardening migrations
- Added `supabase/migrations/20260402152000_harden_suggestions_workspace_settings_ai_usage.sql`
  - Scopes `suggestions` by company and role.
  - Scopes `workspace_settings` by company.
  - Restricts `ai_usage_log` reads to admins in same company.
- Added `supabase/migrations/20260402153000_harden_lead_files_rls.sql`
  - Removes any anonymous read policy.
  - Enforces company-scoped authenticated access for `lead_files`.

### High-priority app fixes
- Fixed auth bootstrap loading hang in `src/lib/auth.tsx` by adding initial `getSession()` bootstrap and safe loading resolution.
- Hardened OAuth callback behavior in `src/pages/IntegrationCallback.tsx`:
  - No wildcard `postMessage`.
  - Uses explicit trusted origin (`VITE_APP_ORIGIN` fallback to `window.location.origin`).
  - Derives callback URI from origin.
- Removed invalid bearer fallback in `src/components/office/TranscribeView.tsx` (now requires real session token).

### Test and stability fixes
- `src/test/extractService.test.ts`: added missing `supabase.auth.getSession` mock.
- Realtime channel scoping:
  - `src/hooks/useExtractSessions.ts`
  - `src/hooks/useBarlists.ts`
  - Channel names now include user/instance scope markers satisfying scoping tests.
- Updated brittle static-analysis tests to reflect current secure behavior:
  - `src/hooks/__tests__/useCEODashboard.test.ts`
  - `src/hooks/__tests__/useOrders.test.ts`
- Improved code-splitting effectiveness:
  - `src/pages/Settings.tsx` now lazy-loads `Integrations` tab page.

### Medium hardening
- Enforced required env vars at app startup in `src/main.tsx`.
- Gated sensitive client debug logs behind dev-mode in `src/lib/downloadUtils.ts`.
- `support-chat` geolocation call upgraded to HTTPS in `supabase/functions/support-chat/index.ts`.
- Restricted broad proxy/scrape endpoints:
  - `supabase/functions/odoo-file-proxy/index.ts`
    - URL proxy mode disabled by default.
    - Optional URL mode gated by `ODOO_PROXY_ALLOW_URL_MODE=true`.
    - Only allows `/web/content/*` when enabled.
  - `supabase/functions/firecrawl-scrape/index.ts`
    - Optional domain allowlist via `FIRECRAWL_ALLOWED_DOMAINS`.
