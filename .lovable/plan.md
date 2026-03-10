

# Audit: Supervisor Controls Inconsistency

## Bug Found
In `CutterStationView.tsx` line 887, the CutEngine receives `isSupervisor={isAdmin || isShopSupervisor}` — this is the **role check**, not the **toggle state**. This means:

- **CutEngine**: Supervisor overrides (bar count adjustments, override warnings) are **always active** for admin/supervisor users, even when the Supervisor toggle is OFF
- **ProductionCard**: Supervisor actions (reset, transfer) correctly follow the toggle state
- **StationHeader**: Toggle button works correctly

A supervisor should explicitly toggle into supervisor mode before getting elevated controls — the toggle exists for safety so operators don't accidentally use supervisor powers.

## Fix

**File: `src/components/shopfloor/CutterStationView.tsx`** (line 887)

Change:
```typescript
isSupervisor={isAdmin || isShopSupervisor}
```
To:
```typescript
isSupervisor={isSupervisor}
```

This makes CutEngine respect the toggle, consistent with how ProductionCard already works. The supervisor must click "Supervisor" in the header to unlock override controls in the cut engine.

## Summary
One-line fix. No other files affected. All supervisor controls will now be gated behind the explicit toggle.

