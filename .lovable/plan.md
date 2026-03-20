

## Fix: Imperial (ft-in) Not Displaying in Results Table

### Root Cause

Two issues prevent Imperial display in the "5 LINE ITEMS" table:

1. **Display uses DB value, not React state**: Lines 2063 and 2072 in `AIExtractView.tsx` check `activeSession?.unit_system` (from DB) to decide formatting. But the DB value is `"metric"` because either the edge function wasn't deployed or the session wasn't refreshed after update.

2. **`loadSession` doesn't restore unit**: When loading a session from history, `selectedUnitSystem` stays at its default `"mm"` instead of reading from `session.unit_system`.

### Changes

**File: `src/components/office/AIExtractView.tsx`**

1. **Use `selectedUnitSystem` for display instead of `activeSession?.unit_system`**: Replace all display references from `activeSession?.unit_system` to `selectedUnitSystem` in the "5 LINE ITEMS" table (lines ~2063 and ~2072) and the dedupe preview table (line ~1889). This ensures the user's selection takes immediate effect without waiting for a DB round-trip.

2. **Sync `selectedUnitSystem` from session on load**: In `loadSession`, add `setSelectedUnitSystem(session.unit_system || "mm")` so that when a user opens an existing session, the correct unit is restored.

3. **Sync when `activeSession` changes**: Add an effect that sets `selectedUnitSystem` from `activeSession.unit_system` whenever the active session data refreshes from the server — this covers the case where `applyMapping` updates the DB and sessions are re-fetched.

**File: `supabase/functions/manage-extract/index.ts`**

4. **Redeploy the edge function**: The current code already has the unit persistence logic (lines 329-334). It needs to be redeployed to ensure it's running the latest version.

### Summary
- Display: use React state `selectedUnitSystem` instead of `activeSession?.unit_system`
- Load: restore unit from session on load
- Sync: keep React state in sync with server after refresh
- Deploy: redeploy edge function to ensure unit persistence works

