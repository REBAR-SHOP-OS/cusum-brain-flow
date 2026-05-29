## Change

Extend storage zone list from Zone 1–5 to **Zone 1–7** across the clearance flow.

## Files to update

1. `src/pages/ClearanceStation.tsx` (line 33) — `STORAGE_ZONES` constant → add `"Zone 6", "Zone 7"`.
2. `src/components/clearance/ClearanceCard.tsx` (line 247) — toast copy: `"Zone 1–5"` → `"Zone 1–7"`.
3. `src/lib/workflowGateError.ts` (line 10) — error message: `"Zone 1–5"` → `"Zone 1–7"`.

## Out of scope

No DB/backend changes (zones are stored as free-text strings, no enum migration needed).
