

## Fix: Zahra's Profile ID Mismatch

### Root Cause
The hardcoded `ZAHRA_PROFILE_ID` in `Tasks.tsx` is `2356f04b-0e8d-4b50-bd62-1aa0420f74ab`, but Zahra's **actual** profile ID in the database is `3a59f057-b232-4654-a2ea-d519fe22ccd5`.

This means:
- `isDelegateFor` never matches for Zahra, so `canDeleteOrFix` returns `false` — Generate Fix and Delete buttons are disabled
- The mirroring code targets the wrong Map entry, so Zahra's column shows "No tasks"

### Fix

**File**: `src/pages/Tasks.tsx`

Update `ZAHRA_PROFILE_ID` from `"2356f04b-0e8d-4b50-bd62-1aa0420f74ab"` to `"3a59f057-b232-4654-a2ea-d519fe22ccd5"`.

**File**: `src/components/feedback/AnnotationOverlay.tsx`

Same fix — update `ZAHRA_PROFILE_ID` to the correct value.

| File | Change |
|---|---|
| `src/pages/Tasks.tsx` | Fix ZAHRA_PROFILE_ID constant |
| `src/components/feedback/AnnotationOverlay.tsx` | Fix ZAHRA_PROFILE_ID constant |

### Result
- Generate Fix and Delete will be enabled for Zahra on Radin's tasks
- Radin's feedback tasks will appear in Zahra's column
- All delegate permissions work correctly

