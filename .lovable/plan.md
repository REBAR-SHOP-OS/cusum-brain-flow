

## Fix: Imperial Selection Gets Overwritten by Stale DB Value

### Root Cause

The pipeline chip shows "Uploaded · metric" even after user selects "Imperial (ft-in)". Here's why:

1. User selects "Imperial (ft-in)" → `setSelectedUnitSystem("imperial")` ✓
2. User clicks "Apply Mapping" → calls edge function with `unitSystem: "imperial"` ✓
3. Edge function should persist `unit_system = "imperial"` to DB, but appears the deployed version may not have this code yet
4. After apply, `refreshSessions()` is called → `activeSession` updates
5. **Bug**: The sync effect (line 257-261) runs and overwrites `selectedUnitSystem` back to `"mm"` because the DB still has `unit_system: "metric"`

```typescript
// This effect is the culprit — it overwrites user's selection with stale DB value
useEffect(() => {
  if (activeSession?.unit_system && activeSession.unit_system !== selectedUnitSystem) {
    setSelectedUnitSystem(activeSession.unit_system);
  }
}, [activeSession?.unit_system]);
```

### Fix — Two Changes

**File: `src/components/office/AIExtractView.tsx`**

1. **Make the sync effect one-directional**: Only sync from DB → state on initial load (when no user selection has been made), not after user explicitly sets a unit. Add a `userSetUnit` ref flag:

```typescript
const userSetUnitRef = useRef(false);

// In handleMappingConfirmed:
userSetUnitRef.current = true;
setSelectedUnitSystem(unitSystem);

// Fix the sync effect — don't overwrite explicit user selection
useEffect(() => {
  if (!userSetUnitRef.current && activeSession?.unit_system) {
    setSelectedUnitSystem(activeSession.unit_system);
  }
}, [activeSession?.unit_system]);
```

2. **Also persist unit_system client-side as fallback**: In `handleApplyMapping`, after the edge function call succeeds, also update the session via client Supabase (belt-and-suspenders):

```typescript
// After applyMapping succeeds:
await supabase.from("extract_sessions")
  .update({ unit_system: selectedUnitSystem } as any)
  .eq("id", activeSessionId);
```

**File: `supabase/functions/manage-extract/index.ts`**

3. **Redeploy edge function**: The code already has the unit persistence logic (lines 329-334). It just needs redeployment. Also fix line 484 to return `effectiveUnit` instead of `session.unit_system` (which is the old value before update).

### Files
- `src/components/office/AIExtractView.tsx` — prevent sync effect from overwriting user selection + client-side fallback persist
- `supabase/functions/manage-extract/index.ts` — fix response to return `effectiveUnit`, redeploy

