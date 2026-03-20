

## Fix: Unit System Not Persisting — Edge Function Redeployment + State Race Condition

### Root Cause

**The edge function is not deployed with the latest code.** The DB shows `unit_system = "metric"` for ALL sessions, even after user selects Imperial. Edge function logs are completely empty, confirming the deployed version doesn't have the unit persistence logic (lines 329-334).

Additionally, there's a **race condition**: the sync effect can overwrite `selectedUnitSystem` back to `"mm"` between when the user confirms mapping and when `handleApplyMapping` reads `selectedUnitSystem`.

### Changes

**1. Redeploy `manage-extract` edge function**
The code at lines 329-334 already persists `unitSystem` to the session. It just needs redeployment.

**2. Fix race condition in `AIExtractView.tsx`**

The current flow has a gap:
- User selects Imperial → `selectedUnitSystem = "imperial"` ✓
- Sync effect fires (because `activeSession.unit_system` changed or component re-rendered) → overwrites back to `"mm"` ✗
- `handleApplyMapping` reads `selectedUnitSystem` which is now `"mm"` ✗

Fix: Store the confirmed unit in a **ref** (not just state) so `handleApplyMapping` always reads the user's last confirmed value, immune to state overwrites.

```typescript
const confirmedUnitRef = useRef<string>("mm");

// In handleMappingConfirmed:
confirmedUnitRef.current = unitSystem;
setSelectedUnitSystem(unitSystem);

// In handleApplyMapping:
const unitToApply = confirmedUnitRef.current;
const result = await applyMapping(activeSessionId, unitToApply);
// Also persist client-side:
await supabase.from("extract_sessions")
  .update({ unit_system: unitToApply } as any)
  .eq("id", activeSessionId);
```

**3. After apply mapping succeeds, force-set state from ref**

After `refreshSessions()` completes, immediately re-set `selectedUnitSystem` from the ref to prevent the sync effect from reverting it:

```typescript
await refreshSessions();
setSelectedUnitSystem(confirmedUnitRef.current); // Force correct value
```

### Files
- `supabase/functions/manage-extract/index.ts` — redeploy (no code change needed)
- `src/components/office/AIExtractView.tsx` — add `confirmedUnitRef`, use it in `handleApplyMapping`, force-set after refresh

