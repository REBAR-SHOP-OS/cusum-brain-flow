

# Fix: QuickBooks "Invalid Number" Error for SalesTermRef

## Root Cause

The `SalesTermRef.value` field in QuickBooks API requires a **numeric ID** (e.g., `"3"`), not a human-readable name like `"Net 30"`.

The `qb_config` table stores `default_sales_term` as `"Net 30"` (the default from the migration). This string is passed directly into `SalesTermRef: { value: "Net 30" }`, which QuickBooks rejects with error code 2090 "Invalid Number".

## Fix

In `supabase/functions/quickbooks-oauth/index.ts`, before building the invoice payload, resolve the term name to its QuickBooks numeric ID by querying the QB Term endpoint. Add a fallback cache/lookup.

### Changes to `supabase/functions/quickbooks-oauth/index.ts`

1. **Add a term-resolution helper** (~line 55): Query QuickBooks `Term` entity by name to get the numeric ID.

```typescript
async function resolveTermId(config: any, termName: string): Promise<string | null> {
  try {
    const result = await qbFetch(config, 
      `query?query=select Id, Name from Term where Name = '${termName.replace(/'/g, "''")}'`
    ) as Record<string, any>;
    const terms = result?.QueryResponse?.Term;
    if (terms && terms.length > 0) return String(terms[0].Id);
    return null;
  } catch { return null; }
}
```

2. **Update `handleCreateInvoice`** (~line 1328): Resolve the term string to a numeric ID before using it.

```typescript
// Before:
const effectiveTerms = salesTermRef || (qbConfig as any).default_sales_term;
// ...
...(effectiveTerms && { SalesTermRef: { value: effectiveTerms } }),

// After:
let effectiveTerms = salesTermRef || (qbConfig as any).default_sales_term;
if (effectiveTerms && isNaN(Number(effectiveTerms))) {
  const resolvedId = await resolveTermId(config, effectiveTerms);
  effectiveTerms = resolvedId || undefined;
}
// ...
...(effectiveTerms && { SalesTermRef: { value: effectiveTerms } }),
```

The `isNaN` check ensures that if the value is already a numeric ID (e.g., `"3"`), it skips the lookup. Only human-readable names like `"Net 30"` trigger the QB query.

### Also fix the same pattern in `handleCreateInvoice` for `salesTermRef` passed from the frontend

The frontend may also pass `"Net 30"` as `salesTermRef`. The same resolution handles both cases since we check the merged `effectiveTerms`.

## Files Changed
| File | Change |
|------|--------|
| `supabase/functions/quickbooks-oauth/index.ts` | Add `resolveTermId` helper, resolve term name to numeric ID before sending to QB |

Single file change. No database or frontend changes needed.

