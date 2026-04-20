

# Investigate why only 1 of expected items shows on Clearance Station for "Rebar Cage (Small)"

## Symptom
Clearance Station screen shows **Manifest: REBAR CAGE (SMALL) — 0/1** with only item **A1003** visible. The user expects a second item to also appear in this manifest.

## Investigation needed

I need to query the live DB to determine the true state of cut_plan_items for the "Rebar Cage (Small)" plan. Three possible root causes:

1. **The second item never reached `phase='clearance'`** — it may still be in `cut_done`, `bending`, or `bend_done`. `useClearanceData.ts` line 38 filters strictly on `.eq("phase", "clearance")`, so any item not yet in clearance is invisible here. This is the most likely cause given the recent trigger changes.

2. **The second item is `bend_type='straight'`** — straight items skip the bend→clearance loop and go directly to `complete` via `auto_advance_item_phase`, so they would never appear on Clearance Station by design.

3. **Multi-tenant filter mismatch** — `useClearanceData` joins via `cut_plans!inner(company_id)` and filters on `companyId`. Unlikely but possible if the second item belongs to a different company.

## Plan of action (post-approval)

### Step 1 — Diagnostic query (read-only)
Run via Supabase read tool:
```sql
SELECT 
  cpi.bar_code, cpi.phase, cpi.bend_type, cpi.asa_shape_code,
  cpi.size_code, cpi.cut_length_mm, cpi.total_pieces,
  cpi.bend_completed_pieces, cpi.cut_completed_pieces,
  cp.name AS plan_name, cp.status AS plan_status, cp.company_id
FROM cut_plan_items cpi
JOIN cut_plans cp ON cp.id = cpi.cut_plan_id
WHERE cp.name ILIKE '%rebar cage%small%'
ORDER BY cpi.bar_code;
```

This reveals:
- How many items the plan has total
- The phase of each (cutting / cut_done / bending / bend_done / clearance / complete)
- Whether any are `bend_type='straight'` (auto-skip clearance)
- Whether `bend_completed_pieces = total_pieces` (a prerequisite for `auto_advance_item_phase` to flip to `clearance`)

### Step 2 — Diagnose the gap
Based on results, the second item is in one of these states:

| State of 2nd item | Why it's missing on Clearance | Fix |
|---|---|---|
| `phase='bend_done'` but `bend_completed_pieces < total_pieces` | Bender hasn't logged all pieces yet | Operator action — finish bending in BENDER dashboard |
| `phase='bend_done'` AND `bend_completed_pieces = total_pieces` | Item-phase auto-advance trigger didn't fire | Run a one-line backfill: `UPDATE cut_plan_items SET phase=phase WHERE id=...` to re-trigger |
| `phase IN ('cut_done','bending')` | Bending in progress / not started | Operator action — proceed in BENDER queue |
| `bend_type='straight'` AND `phase='complete'` | By design — never enters Clearance | Expected; not a bug. Show 1/1 is correct. |
| Different `company_id` | Tenant mismatch | Investigate data anomaly separately |

### Step 3 — Report findings
Reply with the exact diagnosis (no code changes unless an actual data/logic bug is found). If a backfill nudge is needed, propose it as a tiny follow-up migration. If it's an operator-action gap (bender not finished), explain clearly which dashboard the user should check.

## Scope

**This is a diagnostic investigation, not a code change.** No files will be modified until the root cause is confirmed. If a fix is required, it will be presented as a separate small plan (most likely: a one-line UPDATE to re-fire the existing `auto_advance_item_phase` trigger on the stuck row).

**Untouched (until cause confirmed):**
- `useClearanceData.ts` filter logic (correct as-is)
- `auto_advance_item_phase` / `auto_advance_plan_status` triggers (just fixed)
- ClearanceStation UI

## Validation

- ✅ User receives clear answer on where the second item is in the production flow
- ✅ If it's a stuck-state bug, a minimal nudge migration is proposed
- ✅ If it's by-design (straight bar / bender not done), user understands the expected workflow

