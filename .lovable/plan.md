

# Odoo vs ERP Pipeline Sync Audit and Fix

## Findings

### 1. DUPLICATE BUG (Critical -- actively creating duplicates every sync)

**Root cause**: The dedup query on line 87-90 of `odoo-crm-sync/index.ts` uses `serviceClient.from("leads").select("id, metadata").eq("source", "odoo_sync")` **without pagination**. Supabase returns max 1,000 rows by default. With 2,711 odoo_sync leads, ~1,711 leads are invisible to the dedup map. Every sync run creates new records for those 1,711 leads instead of updating them.

**Evidence**: 13 duplicate pairs found, all created today (Feb 13) in two sync runs ~45 min apart (21:39 and 22:23 UTC). Both copies have identical data; the only difference is `synced_at` timestamp.

| odoo_id | Title | Victim ID (older) | Survivor ID (newer) |
|---------|-------|-------------------|---------------------|
| 1683 | S00434: Carleton U Southam Hall | 951ac2e2 | babe21c9 |
| 2073 | S00603: NRC M19 Corridor 102 | 770359ff | ae106b04 |
| 2377 | S00921: New Child and Family Well-Being Centre | 5ad25126 | a732e5ee |
| 2397 | OCDSB Riverview AS Washroom | 3d0ca0cc | 2fe16770 |
| 2657 | Hillcrest High School Phase 2 | 1ed2d038 | 8f3f4919 |
| 2697 | 980 GRANDRAVINE | 23a857cf | 00519956 |
| 2743 | Blantyre Park Outdoor Pool | 2d0c56d0 | a4145ceb |
| 2973 | DCC Construct 427 Mission Support | b002765b | 753bfead |
| 3271 | Huntsmill Park Playground | fbbd531f | 0c940d99 |
| 3328 | Trinity Lutheran Church | 1f6aebda | 8d7da6d6 |
| 3579 | Marline Cages | 9d2c6400 | b28c7a1f |
| 3731 | PFence Microsoft DC YTO11 | 5ccd4b8c | (second entry) |
| 3982 | (13th pair) | (older) | (newer) |

### 2. "New" Column -- CLEAN

6 leads, all legitimate:
- 2 external email RFQs (Cadeploy, Torpave)
- 4 Odoo-synced leads with `odoo_stage = "New"`

No action needed here.

### 3. Stage Mapping -- CORRECT

The `STAGE_MAP` deterministically maps all 22 Odoo stages. Probability normalization (won=100, lost=0) is correct. `expected_value` is set from `expected_revenue`.

## Changes

### Phase 1: Fix the pagination bug in `odoo-crm-sync` (prevents future duplicates)

Replace the single unpaginated query (lines 87-90) with a paginated loop that fetches ALL odoo_sync leads in batches of 1,000 using `.range()`:

```text
Before (broken):
  const { data: existingLeads } = await serviceClient
    .from("leads")
    .select("id, metadata")
    .eq("source", "odoo_sync");
  // Returns max 1,000 rows silently

After (fixed):
  // Paginate to load ALL odoo_sync leads (2,700+)
  const allExisting: Array<{ id: string; metadata: unknown }> = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await serviceClient
      .from("leads")
      .select("id, metadata")
      .eq("source", "odoo_sync")
      .range(from, from + PAGE - 1);
    if (error) throw new Error("Failed to load existing leads: " + error.message);
    if (!data || data.length === 0) break;
    allExisting.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  // Then use allExisting instead of existingLeads
```

This ensures every existing lead is visible to the dedup map, preventing duplicate creation.

### Phase 2: Delete the 13 duplicate victims (data cleanup)

Delete the 13 older duplicate records (keeping the newer `synced_at` survivor in each pair). This is a data operation, not a schema change.

Victim IDs to delete:
```
951ac2e2-39cc-46c9-af7c-6af85833e848
770359ff-1b82-4dd3-a505-7ed6e969bf1a
5ad25126-6029-47e7-a853-effeb085271a
3d0ca0cc-4c14-47ac-963a-c9b54c79eb74
1ed2d038-781b-4601-afa4-d6b2b7bcc4b3
23a857cf-4401-427e-a703-0723ac1b418c
2d0c56d0-bae8-4ef8-81de-62b22016aada
b002765b-e40c-4090-a529-91a4b794d4f9
fbbd531f-7e70-41cf-b529-ce8aa9b317a4
1f6aebda-2046-46c1-bc0f-8e84780bfc7f
9d2c6400-b066-461d-8b72-518024c0daf1
5ccd4b8c-7e26-45f7-bd37-32436634a606
(+ 13th from odoo_id 3982)
```

Rollback map: each deleted victim maps to its survivor (same odoo_id, newer synced_at).

### Phase 3: Deploy and validate

1. Deploy the fixed `odoo-crm-sync` edge function
2. Trigger a sync run
3. Verify: zero new duplicates created, all updates go to existing records

## Technical Details

### File modified: `supabase/functions/odoo-crm-sync/index.ts`

**Lines 86-90** -- Replace the single query with the paginated loop described above, then update the variable name from `existingLeads` to `allExisting` in the `for` loop on line 96.

### Data operation (not migration)

Delete 13 duplicate lead records by ID after confirming survivor exists for each odoo_id.

## Validation Checklist

- [ ] All 2,711+ odoo_sync leads loaded into dedup map (no 1,000-row cap)
- [ ] 13 duplicate pairs resolved (victims deleted, survivors retained)
- [ ] Zero new duplicates after next sync run
- [ ] "New" column still has exactly 6 legitimate leads
- [ ] Stage/probability/value match Odoo for all synced records

