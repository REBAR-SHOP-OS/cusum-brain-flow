

# Fix: QuickBooks GST/HST Tax Code Error (Root Cause)

## Root Cause

The `resolveTaxCodeId` helper queries QuickBooks for a tax code named `"TAX"` — but this is a **US-only** tax code. This QuickBooks account is **Canadian** (realm `9341452420664446`), where tax codes have names like `"HST ON"`, `"GST"`, `"HST"`, etc. The query returns no results, so `resolveTaxCodeId` returns `null`, and the fallback keeps the string `"TAX"` which is invalid for Canadian QBO.

Additionally, Canadian QBO requires a **`TxnTaxDetail`** block at the transaction level with a `TxnTaxCodeRef` pointing to the tax code ID. Without this, QB rejects with error 6000.

## Fix (Two Parts)

### Part 1: Smart Tax Code Resolution with Fallback

Update `resolveTaxCodeId` to handle the case where the exact name isn't found:
- If exact name match fails, query for **any taxable tax code** (`select Id, Name from TaxCode where Active = true`) and pick the first one where `Taxable = true`
- Cache the resolved ID for the duration of the request

### Part 2: Add `TxnTaxDetail` to Invoice and Estimate Payloads

For Canadian QB accounts, the payload must include:
```typescript
TxnTaxDetail: {
  TxnTaxCodeRef: { value: resolvedTaxCodeId }
}
```

QB will auto-calculate the `TotalTax` when `TxnTaxCodeRef` is provided. This is required for non-US locales.

### Implementation in `supabase/functions/quickbooks-oauth/index.ts`

1. **Update `resolveTaxCodeId`** (~line 75): Add fallback query for any active taxable code when exact name match fails.

2. **Update estimate handler** (~line 1188): Add `TxnTaxDetail: { TxnTaxCodeRef: { value: effectiveTaxCode } }` to the payload when `effectiveTaxCode` is a numeric ID.

3. **Update invoice handler** (~line 1374): Same `TxnTaxDetail` addition to the invoice payload.

4. **Update `qb_company_config` default**: Change the DB default from `"TAX"` to `NULL` so the system always auto-resolves from QB rather than assuming US locale. (Migration)

### Migration
```sql
ALTER TABLE qb_company_config 
ALTER COLUMN default_tax_code SET DEFAULT NULL;
```

## Files Changed
| File | Change |
|------|--------|
| `supabase/functions/quickbooks-oauth/index.ts` | Fix tax code resolution fallback + add `TxnTaxDetail` to payloads |
| Migration | Change `default_tax_code` default from `'TAX'` to `NULL` |

