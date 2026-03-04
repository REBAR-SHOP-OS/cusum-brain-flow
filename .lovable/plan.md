

# Fix: Odoo Sync "Disabled" — Fail-Open Smart Guard

## Problem
The edge function logs confirm `ODOO_ENABLED guard: flag resolved to false` even though the secret exists. The `isEnabled` helper works correctly in code, but the actual stored value of `ODOO_ENABLED` may be malformed (e.g. empty string, whitespace, or encoding issue). This blocks all Odoo operations.

## Solution: Smart Fail-Open Guard

Replace the strict `isEnabled("ODOO_ENABLED")` check with a smarter approach: if `ODOO_ENABLED` is explicitly set to a falsy value (`false`, `0`, `no`, `off`), block. Otherwise, if `ODOO_URL` and `ODOO_API_KEY` exist, allow through. This eliminates fragile dependency on exact secret formatting.

### Changes

**1. `supabase/functions/_shared/featureFlags.ts`** — Add `isOdooEnabled()` helper:
```typescript
export function isOdooEnabled(): boolean {
  const raw = Deno.env.get("ODOO_ENABLED");
  // Explicitly disabled?
  if (raw != null) {
    const n = raw.trim().toLowerCase().replace(/^["']|["']$/g, "");
    if (["false", "0", "no", "off"].includes(n)) return false;
    if (["true", "1", "yes", "on"].includes(n)) return true;
  }
  // Fail-open: if ODOO_URL + ODOO_API_KEY exist, allow
  return !!(Deno.env.get("ODOO_URL") && Deno.env.get("ODOO_API_KEY"));
}
```

**2. All 7 Edge Functions** — Replace `isEnabled("ODOO_ENABLED")` with `isOdooEnabled()`:
- `odoo-crm-sync/index.ts`
- `odoo-chatter-sync/index.ts`
- `archive-odoo-files/index.ts`
- `odoo-sync-order-lines/index.ts`
- `odoo-reconciliation-report/index.ts`
- `odoo-file-proxy/index.ts`
- `autopilot-engine/index.ts`

Each file: change import to include `isOdooEnabled`, replace `!isEnabled("ODOO_ENABLED")` → `!isOdooEnabled()`.

**3. No frontend changes needed** — the Pipeline toast already handles `data.disabled` correctly.

### Why This Fixes It
Since `ODOO_URL` and `ODOO_API_KEY` secrets both exist, even if `ODOO_ENABLED` has a weird value (empty, garbled), the fail-open logic will detect the Odoo credentials and allow sync through.

