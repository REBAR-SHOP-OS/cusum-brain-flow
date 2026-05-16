## Connection status — www.rebar.shop

I checked the live connection between this project and `https://www.rebar.shop`. Here's the truth:

| Check | Result |
|---|---|
| Site reachable (`/wp-json/`) | ✅ 200 OK — "Rebar Shop", timezone America/Toronto |
| Stored secrets present | ✅ `WP_BASE_URL`, `WP_USERNAME`, `WP_APP_PASSWORD`, `WC_CONSUMER_KEY`, `WC_CONSUMER_SECRET`, `WC_WEBHOOK_SECRET` |
| WP REST **read** (`GET /wp/v2/posts`) via `wp-test` edge function | ❌ **HTTP 401 — "The provided password is an invalid application password"** |
| WP REST **write** (`POST /wp/v2/posts` draft) via `wp-test` | ❌ HTTP 401 (same cause) |
| WooCommerce REST (`GET /wc/v3/products`) unauthenticated | 401 expected — keys not yet re-tested with a live call |

**Conclusion:** The site is online and the integration code is wired up correctly (full WP + WC client at `supabase/functions/_shared/wpClient.ts`, plus `wp-test`, `wp-speed-optimizer`, `seo-link-audit`, `website-health-check`, `website-speed-audit`). The only blocker is that **`WP_APP_PASSWORD` is no longer valid** — it was either revoked, regenerated, or the username changed on rebar.shop. Read AND write are both blocked until it's rotated.

## Plan to restore read+write

### 1. Rotate `WP_APP_PASSWORD` (required)
- You generate a fresh Application Password in WordPress admin: **Users → Profile (`{WP_USERNAME}`) → Application Passwords → Add New** ("Lovable ERP" is fine as the name) → copy the 24-character password.
- I'll trigger the `update_secret` flow for `WP_APP_PASSWORD` so you can paste it into the secure form. While we're there, confirm `WP_USERNAME` still matches an admin user with `edit_posts` + `manage_woocommerce` capabilities; if not, update it too.

### 2. Verify WooCommerce keys
- Add a tiny live check to the existing `wp-test` edge function: one `GET /wc/v3/products?per_page=1` (read) and one `PUT` on a benign field of that same product reverted immediately (write), so the report covers WP **and** WC in one call. No new function, no schema change.

### 3. Re-run `wp-test` end-to-end
- Invoke `wp-test` again. Expected: `{ ok: true, read.status: "ok", write.status: "ok", wc_read.status: "ok", wc_write.status: "ok" }`. Report the exact response back to you.

### 4. If WC keys also fail
- You regenerate them at **WooCommerce → Settings → Advanced → REST API → Add key** with **Read/Write** permissions for the same admin user, and we update `WC_CONSUMER_KEY` + `WC_CONSUMER_SECRET` via `update_secret`.

### Out of scope
- No changes to the rebar.shop site itself (no plugins, no theme edits).
- No new connectors — Lovable's `wordpress_com` connector only works for WordPress.com‑hosted sites; `www.rebar.shop` is self-hosted WooCommerce, so direct REST + Application Passwords (what's already in place) is the correct mechanism.
- No DB/RLS changes.

### Technical notes
- WP auth header: `Authorization: Basic base64(WP_USERNAME:WP_APP_PASSWORD)` — already used in `_shared/wpClient.ts`.
- WC auth: `consumer_key` + `consumer_secret` query params over HTTPS — already used in `wp-speed-optimizer/index.ts:232`.
- All writes are logged via `logWpChange()` (audit trail preserved).

Approve and I'll add the WC test to `wp-test`, prompt you to paste the new Application Password, and re-run the verification.