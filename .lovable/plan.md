
# Fix: "Vault 1" / "JD Sector Vault" Missing from Production Queue

## Root Cause

The project "JD Sector Vault" is linked to customer `52e968f1` ("SECTOR CONTRACTING LTD.") which has `company_id = NULL`. Row Level Security hides this customer, so the Production Queue tree builder skips the entire branch (line 302: `if (!resolvedName) return`).

There are 5 duplicate "SECTOR CONTRACTING" customer records. The one the project uses (`52e968f1`) is the only one with NULL company_id.

## Fix (Two Parts)

### 1. Data fix -- set company_id on the orphaned customer record
```sql
UPDATE customers
SET company_id = 'a0000000-0000-0000-0000-000000000001'
WHERE id = '52e968f1-1cf9-4a49-bdf8-e1b3c75d04f3';
```

This immediately makes "JD Sector Vault" and "Vault 1" visible in the Production Queue.

### 2. Code hardening -- make the tree builder resilient to missing customers
Update line 302 in `src/components/office/ProductionQueueView.tsx` so that instead of silently skipping unresolved customers, it falls back to a placeholder name like "Unknown Customer (id)". This prevents items from disappearing if the data issue recurs.

```text
Before: if (!resolvedName) return;
After:  const displayName = resolvedName || "Unknown Customer";
```

## Files Modified

| Item | Change |
|---|---|
| Database | Set company_id on customer 52e968f1 |
| `src/components/office/ProductionQueueView.tsx` | Fallback name for unresolved customers instead of skipping |

## Expected Result
"SECTOR CONTRACTING LTD." will appear in the Production Queue with the "JD Sector Vault" project containing both the "Vault 1" and "JD Sector Vault" barlists and their draft manifests.
