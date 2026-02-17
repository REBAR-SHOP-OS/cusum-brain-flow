
# Fix: "Vault 1" Missing from Production Queue

## Root Cause

The customer **SECTOR CONTRACTING LTD.** (linked to the "JD Sector Vault" project that contains the "Vault 1" barlist) has `company_id = NULL` in the database. The security policy on the `customers` table requires `company_id` to match the logged-in user's company. Since `NULL` never matches anything, the customer record is invisible to the app.

The Production Queue tree builder skips any customer it cannot resolve by name (line 302: `if (!resolvedName) return`). So the entire SECTOR CONTRACTING branch -- including its project, barlist, and manifest -- is silently dropped from the queue.

## Fix (Two Parts)

### 1. Backfill the missing company_id (data fix)
Set `company_id` on the 2 customers that currently have `NULL`:

```sql
UPDATE customers
SET company_id = 'a0000000-0000-0000-0000-000000000001'
WHERE company_id IS NULL;
```

This immediately makes SECTOR CONTRACTING visible, and "Vault 1" will appear in the Production Queue under its correct customer and project.

### 2. Prevent future orphans (code fix)
When the AI Extract flow creates a new customer, ensure `company_id` is always populated. I will audit the customer-creation paths (AI Extract, manual creation) and add the logged-in user's `company_id` as a required default so this cannot recur.

## Files Modified

| Item | Change |
|---|---|
| Database migration | Backfill `company_id` on customers with NULL |
| Customer creation code paths | Ensure `company_id` is always set on insert |

## Expected Result
After the migration, "Vault 1" will appear in the Production Queue under **SECTOR CONTRACTING LTD. > JD Sector Vault > Vault 1**, with its DRAFT manifest visible and editable.
