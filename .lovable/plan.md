

# Odoo Sync Error: Configuration Issue

## Problem

The "Odoo Sync Disabled" toast is not a code bug. The `odoo-crm-sync` edge function checks the `ODOO_ENABLED` environment secret and returns `{ disabled: true }` when it's not set to `"true"`.

The secret `ODOO_ENABLED` exists in your project secrets, but its value may have been cleared or changed.

## Fix

I'll update the `ODOO_ENABLED` secret value to `true` so the Odoo sync functions work again. No code changes needed.

| Action | Detail |
|--------|--------|
| Update secret `ODOO_ENABLED` | Set value to `true` |

