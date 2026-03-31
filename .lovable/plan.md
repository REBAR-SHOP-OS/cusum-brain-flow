

# Fix LENGTH Column Unit Display

## Analysis Summary

After thorough investigation, there is **no hardcoded "mm" suffix on bar_size** anywhere in the codebase. The SIZE column correctly displays raw values like "20M", "10M" from the database.

The confirmed issue is the **LENGTH column header** showing "(mm)" when the source data may actually be in different units (e.g., inches). Two related problems:

### Problem 1: `loadSession()` doesn't sync `displayUnit`
When loading a session from history (line 696-715), `loadSession()` sets `selectedUnitSystem` but **does not set `displayUnit`**. This means `displayUnit` stays at its default "mm" even if the session was saved with `unit_system = "in"`.

### Problem 2: No automatic unit validation
If the user selects "Millimeters" as source but the data is actually in inches (e.g., 78 inches = 1981mm), the system stores 78 as-is and shows "LENGTH (mm)" — which is misleading.

## Fix

### File: `src/components/office/AIExtractView.tsx`

**Fix 1** — In `loadSession()` (around line 703), add `setDisplayUnit(restoredUnit)`:

```typescript
const restoredUnit = session.unit_system || "mm";
setSelectedUnitSystem(restoredUnit);
setDisplayUnit(restoredUnit);   // ← ADD THIS LINE
confirmedUnitRef.current = restoredUnit;
```

This ensures that when navigating to a previously saved session with `unit_system = "in"`, the display toggle and LENGTH header correctly show "in" instead of defaulting to "mm".

**Fix 2** — In `startNew()` (around line 717), reset `displayUnit` as well:

```typescript
setDisplayUnit("mm");  // ← ADD THIS LINE (reset on new session)
```

## Impact
- Single file change (`AIExtractView.tsx`), 2 lines added
- No database, edge function, or schema changes
- The display unit toggle (mm/in/ft/ft-in) already works correctly when clicked manually — this fix just ensures it initializes correctly from the saved session

