
# Full Odoo-ERP Pipeline Reconciliation Plan

## Audit Findings

### 1. Data Summary
- **Total ERP leads (odoo_sync)**: 2,823
- **Unique Odoo IDs**: 2,691
- **Duplicate groups**: 132 (132 extra records with same odoo_id)
- **Non-odoo leads**: 44 (RFQ email scans, manual)
- **Archived orphans**: 34 (no odoo_id, legacy data)

### 2. Critical Issues Found

**A. 132 Duplicate Groups**
Each duplicate pair has one "old" record (created Feb 10, with S-prefix title like `S03617, ...`) and one "new" record (created Feb 13, with Odoo's native title). The root cause is a bug in `odoo-crm-sync`: when loading existing leads, `Map.set(odoo_id, lead_id)` keeps only the LAST match. If there were already duplicates before the dedup map was added, or if a prior sync run created entries without `odoo_id` in metadata, the map misses them.

**B. Probability Not Normalized**
- 874 won leads have probability < 100 (should be 100)
- 37 lost leads have probability > 10 (should be 0)
- The sync blindly copies Odoo's ML probability instead of enforcing won=100, lost=0.

**C. Stage-Mismatch Duplicates**
~18 duplicate pairs have conflicting stages (e.g., one says `hot_enquiries`, the other says `lost`). The newer record (from Odoo's latest sync) has the authoritative stage.

---

## Execution Plan

### PHASE 1: Deduplicate 132 Groups (DB operations)

For each duplicate group:
- **Survivor**: the record most recently updated (newer `synced_at`)
- **Victim**: the older record
- Merge: copy any non-null fields from victim into survivor (e.g., `customer_id` if survivor is null)
- Delete victim
- Log old_id to survivor_id mapping

SQL strategy:
```text
-- For each duplicate group, keep the record with latest synced_at
-- Delete the other, after merging customer_id if needed
WITH dupes AS (
  SELECT metadata->>'odoo_id' as odoo_id,
    array_agg(id ORDER BY (metadata->>'synced_at')::timestamptz DESC NULLS LAST) as ids
  FROM leads WHERE source = 'odoo_sync' AND metadata->>'odoo_id' IS NOT NULL
  GROUP BY metadata->>'odoo_id' HAVING COUNT(*) > 1
)
-- survivor = ids[1], victim = ids[2]
-- DELETE from leads WHERE id IN (all victims)
```

### PHASE 2: Fix Probability Normalization

```text
UPDATE leads SET probability = 100 
WHERE source = 'odoo_sync' AND stage = 'won' AND probability != 100;

UPDATE leads SET probability = 0 
WHERE source = 'odoo_sync' AND stage = 'lost' AND probability != 0;
```

### PHASE 3: Fix Sync Function to Prevent Future Duplicates

File: `supabase/functions/odoo-crm-sync/index.ts`

Changes:
1. **Dedup-safe map loading**: When building `odooIdMap`, if multiple records share the same `odoo_id`, keep the one with latest `synced_at` and DELETE the others immediately.
2. **Probability override**: After stage mapping, force `probability = 100` for `won` and `probability = 0` for `lost`.
3. **Title update**: Also update `title` on existing records (currently only stage/probability/metadata are updated, so old S-prefix titles persist).

```text
// In the update block, add title:
.update({
  title: ol.name || existingTitle,   // <-- NEW
  stage: erpStage,
  probability: erpStage === 'won' ? 100 : erpStage === 'lost' ? 0 : Math.round(...),
  ...
})
```

### PHASE 4: Stage Mapping Table (No Changes Needed)

Current mapping is already deterministic and complete:

| Odoo Stage | ERP Stage |
|---|---|
| New | new |
| Telephonic Enquiries | telephonic_enquiries |
| Qualified | qualified |
| RFI | rfi |
| Addendums | addendums |
| Estimation-Ben | estimation_ben |
| Estimation-Karthick(Mavericks) | estimation_karthick |
| QC - Ben | qc_ben |
| Hot Enquiries | hot_enquiries |
| Quotation Priority | quotation_priority |
| Quotation Bids | quotation_bids |
| Shop Drawing | shop_drawing |
| Shop Drawing Sent for Approval | shop_drawing_approval |
| Fabrication In Shop | shop_drawing |
| Delivered/Pickup Done | won |
| Ready To Dispatch/Pickup | won |
| Won | won |
| Loss | lost |
| Merged | lost |
| No rebars(Our of Scope) | lost |

### PHASE 5: Field Mapping Table

| Odoo Field | ERP Column | ERP Metadata Key | Rule |
|---|---|---|---|
| id | -- | odoo_id | Unique dedup key |
| name | title | -- | Direct copy |
| stage_id[1] | stage | odoo_stage | Via STAGE_MAP |
| partner_name | -- (via customer_id) | odoo_partner | Customer lookup/create |
| contact_name | -- | odoo_contact | Stored in metadata |
| email_from | -- | odoo_email | Stored in metadata |
| phone | -- | odoo_phone | Stored in metadata |
| expected_revenue | expected_value | odoo_revenue | Direct copy |
| probability | probability | odoo_probability | Normalized: won=100, lost=0 |
| user_id[1] | -- | odoo_salesperson | Stored in metadata |
| city | -- | odoo_city | Stored in metadata |
| priority | priority | odoo_priority | 3=high, 2=medium, else=low |

### PHASE 6: Sync Policy Document

```text
SOURCE OF TRUTH:
  - Odoo: stage, probability, expected_value, contacts, activity
  - ERP: internal ops fields (work orders, production, financials)

CONFLICT RESOLUTION:
  - Odoo always wins for synced fields
  - ERP-only fields are never overwritten by sync

DEDUP RULE:
  - metadata->>'odoo_id' is the unique key
  - On sync, if multiple ERP records share same odoo_id, 
    keep latest, delete rest

SYNC WINDOW: 5 days (write_date filter)

PROBABILITY NORMALIZATION:
  - won stage -> 100%
  - lost stage -> 0%
  - all other stages -> Odoo's ML probability (rounded)
```

### PHASE 7: UX Alignment (No Major Changes)

The current Pipeline UI already mirrors Odoo's Kanban layout:
- Same stage names and order
- Same drawer navigation with stage chips
- Same color coding (emerald=won, zinc=lost)
- Probability and revenue displayed identically

No UX changes needed -- already aligned.

---

## Summary of Changes

| Action | Scope | Records Affected |
|---|---|---|
| Delete duplicate victims | DB | 132 records |
| Fix won probability | DB | 874 records |
| Fix lost probability | DB | 37 records |
| Update sync function (dedup + prob normalization + title sync) | Code | 1 file |
| Total leads after cleanup | -- | ~2,691 unique |

## Verification Checklist

- [ ] Record count: unique odoo_ids = ERP lead count (for odoo_sync source)
- [ ] Zero duplicate groups (COUNT by odoo_id HAVING > 1 = 0)
- [ ] All won leads have probability = 100
- [ ] All lost leads have probability = 0
- [ ] Future syncs don't create duplicates (re-run sync, verify no new dupes)
- [ ] Stage parity: ERP stages match Odoo stages via mapping table
