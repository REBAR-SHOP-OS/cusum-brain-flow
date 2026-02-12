
# Fix Odoo Integration Status -- Duplicate Variable Bug

## Problem
The `sync-odoo-leads` edge function has a **syntax error** that prevents it from loading at all:
- Line 208: `const body = await req.clone().json().catch(() => ({}));` (for check-status)
- Line 256: `const body = await req.json().catch(() => ({}));` (for the sync logic)

Both use `const body` in the same function scope, causing `Identifier 'body' has already been declared`. This means every call to this function fails silently, so the Odoo status check never returns "connected."

## Fix

One small change in `supabase/functions/sync-odoo-leads/index.ts`:

Rename the second `body` declaration at line 256 from:
```ts
const body = await req.json().catch(() => ({}));
```
to:
```ts
const syncBody = await req.json().catch(() => ({}));
```

And update the reference on line 257 from `body.force` to `syncBody.force`.

No other files need to change. After deploying the fixed function, the Odoo card will correctly show "Connected" on page load.

### Files to modify
- `supabase/functions/sync-odoo-leads/index.ts` (lines 256-257)
