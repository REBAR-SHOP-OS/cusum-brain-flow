

# QA War Simulation Round 14 -- Delivery Workflow, Inventory Guards, Notification Reliability

---

## BUG R14-1 -- HIGH: Delivery status has no transition validation

**Files**: `src/pages/Deliveries.tsx`, `src/pages/DriverDashboard.tsx`

Unlike orders (`ALLOWED_TRANSITIONS` in `useOrders.ts`) and expense claims (`ALLOWED_EXPENSE_TRANSITIONS` in `useExpenseClaims.ts`), delivery status updates have zero transition validation. The delivery status is set via raw `.update({ status: ... })` calls with no guard.

**Flow**:
1. Driver opens DriverDashboard, delivery is "pending"
2. Driver calls `startDelivery()` which sets status to "in-transit" (line 162 of DriverDashboard.tsx)
3. Any user with DB write access can set a "completed" delivery back to "pending" or "in-transit" via direct mutation
4. No `ALLOWED_DELIVERY_TRANSITIONS` map exists anywhere in the codebase

**Valid transitions should be**:
```text
pending → scheduled → in-transit → delivered/completed/completed_with_issues
                                  → partial → in-transit (retry)
                                  → failed
```

**Impact**: Delivery workflow can be corrupted. A completed delivery could be re-opened, causing duplicate POD captures and driver confusion.

**Fix**:
1. Create `ALLOWED_DELIVERY_TRANSITIONS` map (client-side, in a shared hook or `Deliveries.tsx`)
2. Validate before every `.update({ status })` call in `Deliveries.tsx` and `DriverDashboard.tsx`
3. Optionally add a DB trigger on `deliveries` table to enforce server-side

**Severity**: HIGH -- workflow integrity gap, inconsistent with order/expense patterns.

---

## BUG R14-2 -- MEDIUM: Delivery delete does not check for in-transit or completed status at DB level

**File**: `src/pages/Deliveries.tsx` lines 113-134

The UI checks `delivery.status !== "pending"` before allowing delete (line 116), but this is a client-only guard. The actual DB delete (line 122) has no server-side constraint. A direct API call or race condition could delete an in-transit delivery with active stops.

The delete sequence also has a non-atomic multi-table deletion:
1. Delete `packing_slips` (line 120)
2. Delete `delivery_stops` (line 121)
3. Delete `deliveries` (line 122)

If step 3 fails, stops and slips are already deleted -- orphaned data loss.

**Fix**:
1. Add a DB trigger `block_delivery_delete_unless_pending` that raises exception if `OLD.status != 'pending'`
2. Or use CASCADE foreign keys so deleting the delivery cascades to stops and slips atomically

**Severity**: MEDIUM -- mitigated by UI guard, but no server-side defense.

---

## BUG R14-3 -- MEDIUM: Inventory `consume-on-start` can drive `qty_on_hand` to zero but not below due to `Math.max(0, ...)` -- masking over-consumption

**File**: `supabase/functions/manage-inventory/index.ts` lines 291-294

```typescript
await svc.from("inventory_lots").update({
  qty_on_hand: Math.max(0, lot.qty_on_hand - qty),
  qty_reserved: Math.max(0, lot.qty_reserved - qty),
}).eq("id", sourceId);
```

The `Math.max(0, ...)` silently clamps negative values instead of rejecting over-consumption. If two concurrent consume requests race, both could read the same `qty_on_hand` and both succeed -- the second one just clamps to 0 without error.

**Impact**: Inventory phantom stock. The system believes it consumed N units, but the lot only had M < N. No error is raised, no alert generated. Financial and production planning data becomes unreliable.

**Fix**:
1. Before update, check `lot.qty_on_hand >= qty` -- return 400 if insufficient
2. Use an atomic RPC function: `UPDATE ... SET qty_on_hand = qty_on_hand - $1 WHERE qty_on_hand >= $1 RETURNING qty_on_hand` to prevent race conditions
3. Keep `Math.max(0, ...)` only for `qty_reserved` (which may lag behind)

**Severity**: MEDIUM -- silent data corruption in inventory accounting.

---

## BUG R14-4 -- LOW: `push-on-notify` has no retry or dead-letter on `send-push` failure

**File**: `supabase/functions/push-on-notify/index.ts` lines 40-53

The function calls `send-push` via `fetch()` and reads the result, but if `send-push` returns an error or times out:
- The notification INSERT in the DB succeeded (trigger already fired)
- The push notification is silently lost
- No retry mechanism exists
- No failed-push log is written

**Flow**:
1. Notification inserted into `notifications` table
2. DB webhook triggers `push-on-notify`
3. `push-on-notify` calls `send-push`
4. `send-push` returns 500 (e.g., FCM token expired)
5. `push-on-notify` returns `{ ok: true, push: { error: "..." } }` -- it treats the error response as success

**Fix**:
1. Check `resp.ok` before returning success
2. On failure, log to an `activity_events` entry with `event_type: "push_failed"` for observability
3. Consider a `push_delivery_status` column on `notifications` table (pending/sent/failed)

**Severity**: LOW -- in-app notifications still work, only push delivery is silently lost. But for mobile-first users this creates notification blindspots.

---

## Positive Findings (No Bug)

- **Inventory reservation idempotency**: `manage-inventory` reserve action checks for existing reservation with same `source_id + cut_plan_item_id` before creating (lines 232-243). Solid dedup.
- **Delivery QC gate**: `block_delivery_without_qc` DB trigger prevents deliveries from going to "loading" or "in-transit" if QC evidence is missing. Excellent safety net.
- **Notification deduplication**: All edge functions use `dedupe_key` on `activity_events` with `onConflict: "dedupe_key", ignoreDuplicates: true`. Consistent pattern.
- **Delivery realtime**: Deliveries page has proper realtime subscription with channel cleanup (lines 253-268).
- **Packing slip delete guard**: Only "draft" slips can be deleted (line 243, `.eq("status", "draft")`).

---

## Summary Table

| ID | Severity | Module | Bug | Status |
|----|----------|--------|-----|--------|
| R14-1 | HIGH | Delivery | No status transition validation (unlike orders/expenses) | New |
| R14-2 | MEDIUM | Delivery | Delete has no server-side status guard + non-atomic multi-table delete | New |
| R14-3 | MEDIUM | Inventory | `Math.max(0)` masks over-consumption silently, race-condition vulnerable | New |
| R14-4 | LOW | Notifications | `push-on-notify` does not detect/log `send-push` failures | New |

---

## Implementation Plan

### Step 1: Fix R14-1 (HIGH) -- Delivery status transition validation

**New constant** in `src/pages/Deliveries.tsx` (or shared utility):
```typescript
const ALLOWED_DELIVERY_TRANSITIONS: Record<string, string[]> = {
  pending: ["scheduled", "in-transit"],
  scheduled: ["in-transit", "pending"],
  "in-transit": ["delivered", "completed", "completed_with_issues", "partial", "failed"],
  partial: ["in-transit", "completed_with_issues"],
  delivered: ["completed"],
  completed: [],
  completed_with_issues: [],
  failed: ["pending"],
};
```

Apply validation before every `supabase.from("deliveries").update({ status })` call in both `Deliveries.tsx` and `DriverDashboard.tsx`.

### Step 2: Fix R14-2 (MEDIUM) -- Delivery delete server-side guard

**DB Migration**: Create trigger `block_delivery_delete_unless_pending`:
```sql
CREATE OR REPLACE FUNCTION public.block_delivery_delete_unless_pending()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS NOT NULL AND OLD.status != 'pending' THEN
    RAISE EXCEPTION 'Cannot delete delivery in status: %', OLD.status;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER block_delivery_delete_unless_pending
BEFORE DELETE ON public.deliveries
FOR EACH ROW
EXECUTE FUNCTION public.block_delivery_delete_unless_pending();
```

### Step 3: Fix R14-3 (MEDIUM) -- Inventory over-consumption guard

In `manage-inventory/index.ts` `consume-on-start` case, add pre-update check:
```typescript
if (lot.qty_on_hand < qty) {
  return json({ error: `Over-consumption: only ${lot.qty_on_hand} on hand, ${qty} requested` }, 400);
}
```
Same for floor stock. Keep `Math.max(0, ...)` only for `qty_reserved`.

### Step 4: Fix R14-4 (LOW) -- Push failure logging

In `push-on-notify/index.ts`, check `resp.ok` and log failures:
```typescript
const result = await resp.json();
if (!resp.ok || result?.error) {
  console.error("Push delivery failed:", result);
  // Best-effort log to activity_events
}
```

### Do NOT touch:
- `block_delivery_without_qc` trigger (correct)
- Inventory reservation idempotency (correct)
- Realtime subscription logic (correct)
- Any R7-R13 fixes

---

## Updated Technical Debt Score: 1.2/10

| Category | Score | Delta |
|----------|-------|-------|
| Multi-tenant isolation | 9/10 | unchanged |
| Workflow integrity | 7/10 | -1 (delivery transitions missing) |
| Financial controls | 7/10 | +2 (R13 expense fix deployed) |
| Inventory accuracy | 6/10 | NEW (silent over-consumption risk) |
| Notification reliability | 8/10 | NEW (push failure silent) |
| Data integrity | 9/10 | unchanged |

