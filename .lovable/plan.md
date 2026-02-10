

# Fix: Auto-Clean Odoo URL in Code

## The Problem

The `ODOO_URL` secret contains `https://rebarshop-24-rebar-shop.odoo.com/web/login`, but the API endpoints need just `https://rebarshop-24-rebar-shop.odoo.com`. The current code only strips trailing slashes, not the `/web/login` suffix.

## The Fix (No Secret Changes Needed)

Instead of asking you to update the secret, we'll make the code smart enough to **automatically strip known Odoo URL suffixes** like `/web/login`, `/web`, `/web/database/selector`, etc.

One line change in `supabase/functions/sync-odoo-leads/index.ts`:

```text
Before:
  const url = rawUrl.replace(/\/+$/, "");

After:
  const url = rawUrl.replace(/\/web(\/login|\/database\/selector)?\/?$/, "").replace(/\/+$/, "");
```

This means no matter what format the URL is stored in, the code will always extract the correct base URL:
- `https://rebarshop-24-rebar-shop.odoo.com/web/login` becomes `https://rebarshop-24-rebar-shop.odoo.com`
- `https://rebarshop-24-rebar-shop.odoo.com/web` becomes `https://rebarshop-24-rebar-shop.odoo.com`
- `https://rebarshop-24-rebar-shop.odoo.com` stays unchanged

## File Changed

| File | Change |
|------|--------|
| `supabase/functions/sync-odoo-leads/index.ts` | Add URL suffix sanitizer (1 line change), then redeploy and test |

Everything else (stage mapping, dedup, customer creation, UI) stays the same.

