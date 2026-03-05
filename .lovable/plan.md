

# Odoo Sync Fix — Root Cause Analysis & Plan

## Problems Found

### 1. Map Key Type Mismatch (ROOT CAUSE of "every lead hits unique index")

In `odoo-crm-sync/index.ts` line 188, existing leads are loaded and their `odoo_id` is cast as-is (`meta?.odoo_id as string`). But the database has **mixed types**: 2,191 leads store `odoo_id` as a JSON number (`1944`) and 599 store it as a JSON string (`"1944"`).

When building the lookup Map, number-typed values become numeric keys (e.g., `1944`). But the lookup at line 239 uses `String(ol.id)` which is `"1944"`. JavaScript Maps treat `1944 !== "1944"`, so the lookup fails, and every lead falls through to the insert path, hits the unique index, and does a slow fallback update.

This makes every sync run process ALL ~2,800 leads as "duplicate caught by unique index" instead of a fast update — causing timeouts and the "failed" error.

### 2. Metadata `odoo_id` stored as number, should be string

Line 247: `odoo_id: odooId` where `odooId = String(ol.id)` — this correctly stores as string on NEW inserts. But the fallback update at line 401-403 re-stores the whole `insertPayload` which has string `odoo_id`. So over time, records flip between number and string. Need to normalize all to string.

### 3. Duplicate React Keys in Pipeline (secondary)

The pipeline fetches leads with `order by updated_at desc` using range pagination. During sync, `updated_at` changes, causing leads to shift between pages — the same lead can appear on page 1 and page 2. This produces the "two children with the same key" React warnings.

## Fix Plan

### Step 1: Fix Map key normalization in `odoo-crm-sync/index.ts`

Change line 188 from `const oid = meta?.odoo_id as string` to `const oid = String(meta?.odoo_id)`. This ensures the Map key is always a string, matching the `String(ol.id)` lookup.

### Step 2: Normalize all existing `odoo_id` values to strings (SQL)

```sql
UPDATE leads 
SET metadata = jsonb_set(metadata, '{odoo_id}', to_jsonb((metadata->>'odoo_id')::text))
WHERE metadata->>'odoo_id' IS NOT NULL 
AND jsonb_typeof(metadata->'odoo_id') = 'number';
```

This converts 2,191 number-typed values to strings, preventing the mismatch permanently.

### Step 3: Deduplicate pipeline fetch to prevent React key warnings

In `Pipeline.tsx` line 195, after `allLeads = allLeads.concat(data)`, add deduplication:
```typescript
// Deduplicate by id (pagination during sync can cause overlaps)
const seen = new Set<string>();
allLeads = allLeads.filter(l => { if (seen.has(l.id)) return false; seen.add(l.id); return true; });
```

### Step 4: Also fix the same type issue in `odoo-chatter-sync`

The chatter sync has the same pattern — `odooToLead.set(Number(l.odoo_id), l.id)` and lookups via `msg.res_id` (number). This one is actually correct since both sides are numbers, but we should normalize for safety.

| File | Change |
|------|--------|
| `supabase/functions/odoo-crm-sync/index.ts` | Normalize Map keys with `String()` |
| Database (SQL) | Convert 2,191 number-typed `odoo_id` to strings |
| `src/pages/Pipeline.tsx` | Deduplicate leads after paginated fetch |

**Expected result**: Sync completes in seconds (direct updates, no index fallbacks), no React key warnings, no "failed" errors.

