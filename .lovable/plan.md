

## Fix: Unit System Not Persisting — Barlist Conversion Broken

### Root Cause

The user selects "Imperial (ft-in)" in the mapping panel, but the database always shows `unit_system = "metric"` for all sessions. Two bugs cause this:

**Bug 1: Client-side update silently fails due to RLS**

`handleMappingConfirmed` (AIExtractView.tsx line 497) tries to update `unit_system` on `extract_sessions` using the client-side Supabase instance. The RLS policy "Office and admin can update sessions" requires specific roles. If the update fails, there's no error handling — it fails silently.

**Bug 2: Unit is not passed to the edge function**

`applyMapping(sessionId)` in extractService.ts only sends `sessionId` to the edge function. The edge function then reads `unit_system` from the session row — which is still `"metric"` because Bug 1 prevented the update.

### Fix

**File: `src/lib/extractService.ts`** — Add `unitSystem` parameter to `applyMapping`:
```typescript
export async function applyMapping(sessionId: string, unitSystem?: string) {
  const { data, error } = await supabase.functions.invoke("manage-extract", {
    body: { action: "apply-mapping", sessionId, unitSystem },
  });
```

**File: `src/components/office/AIExtractView.tsx`** — Two changes:
1. Store selected unit from `handleMappingConfirmed` in component state
2. Pass it to `applyMapping(activeSessionId, selectedUnit)` in `handleApplyMapping`

**File: `supabase/functions/manage-extract/index.ts`** — In `applyMapping` function:
1. Accept `unitSystem` from request body params
2. Update the session's `unit_system` server-side (using admin client, bypassing RLS) before applying conversion
3. Change signature: `async function applyMapping(sb, sessionId, unitSystem?)`

### Flow After Fix

1. User selects "Imperial (ft-in)" → confirms mapping
2. `handleMappingConfirmed` stores unit in React state (no DB write needed)
3. User clicks "Apply Mapping" → calls `applyMapping(sessionId, "imperial")`
4. Edge function receives `unitSystem: "imperial"`, writes it to session via admin client, then applies `lengthFactor = 25.4` to all rows

### Files
- `src/lib/extractService.ts` — add unitSystem param
- `src/components/office/AIExtractView.tsx` — track + pass unit
- `supabase/functions/manage-extract/index.ts` — receive + persist + apply unit

