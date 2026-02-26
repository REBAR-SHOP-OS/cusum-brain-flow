

# QA War Simulation Round 13 -- Expense Workflow, Autopilot Safety, Machine Isolation

---

## BUG R13-1 -- HIGH: Expense claims have no self-approval guard

**File**: `src/components/accounting/ExpenseClaimsManager.tsx` lines 65-73  
**File**: `src/hooks/useExpenseClaims.ts` lines 88-105

The "Approve" button is visible to **any** user viewing a submitted expense claim, including the submitter themselves. There is no check that the approver is different from the claim owner. The `block_self_approval` DB trigger exists for **leave requests** but there is **no equivalent trigger on `expense_claims`**.

**Flow**:
1. Employee creates expense claim, adds items, clicks "Submit"
2. Same employee opens the claim, sees "Approve" button, clicks it
3. `updateClaim.mutate({ id, status: "approved" })` runs
4. `useExpenseClaims` sets `reviewed_by` to the current user's profile ID
5. No DB trigger blocks this -- the claim is self-approved

**Impact**: Financial fraud risk. Employee can submit and approve their own expenses without oversight.

**Fix (two layers)**:

1. **Client-side**: In `ExpenseClaimsManager.tsx`, hide Approve/Reject buttons when `claim.profile_id === currentUserProfileId`
2. **DB trigger**: Create a `block_expense_self_approval` trigger on `expense_claims` (matching the existing `block_self_approval` on `leave_requests`)

**Severity**: HIGH -- financial controls bypass.

---

## BUG R13-2 -- MEDIUM: Autopilot `reject_run` does not validate current status

**File**: `supabase/functions/autopilot-engine/index.ts` lines 373-396

The `approve_run` action correctly checks `run.status !== "awaiting_approval"` (line 351). But `reject_run` does NOT check status at all (line 384 jumps straight to the update). This means:
- A **completed** run can be retroactively "rejected", setting status to `cancelled`
- A run that is **already executing** can be cancelled mid-flight without stopping the lock holder

**Flow**:
1. Admin approves and executes a run (status: `executing`)
2. Another admin calls `reject_run` with the same `run_id`
3. Run status is overwritten to `cancelled`, actions set to `rejected`
4. The executing loop continues operating on stale state -- executed actions are marked "completed" but the run is "cancelled"

**Fix**: Add status guard: `if (!["awaiting_approval", "approved"].includes(run.status)) return json({ error: "Cannot reject" }, 400)`

**Severity**: MEDIUM -- autopilot state corruption, mitigated by admin-only access.

---

## BUG R13-3 -- MEDIUM: `manageMachine` service has no client-side input validation

**File**: `src/lib/manageMachineService.ts` lines 38-46

The service passes all params directly to the edge function with no validation:
- `machineId` could be empty string or "null"
- `action` is typed but not runtime-validated
- `barCode`, `qty`, `outputQty` accept any value including negatives
- No check that `machineId` is a valid UUID format

While the edge function does server-side validation, sending garbage params wastes a round-trip and produces unclear error messages.

**Fix**: Add runtime validation before the `supabase.functions.invoke` call:
```typescript
if (!params.machineId || params.machineId === "null") throw new Error("Invalid machineId");
if (params.qty !== undefined && params.qty < 0) throw new Error("qty cannot be negative");
if (params.outputQty !== undefined && params.outputQty < 0) throw new Error("outputQty cannot be negative");
```

**Severity**: MEDIUM -- UX and defensive programming. Server blocks bad requests but errors are opaque.

---

## BUG R13-4 -- LOW: Expense claim status transitions have no validation

**File**: `src/hooks/useExpenseClaims.ts` lines 88-105

Similar to the R12 order status issue: `updateClaim` accepts any status string. A claim can jump from `draft` directly to `paid`, bypassing submission, review, and approval.

**Fix**: Add an `ALLOWED_EXPENSE_TRANSITIONS` map:
```typescript
const ALLOWED_EXPENSE_TRANSITIONS: Record<string, string[]> = {
  draft: ["submitted"],
  submitted: ["approved", "rejected"],
  approved: ["paid"],
  rejected: ["draft"],  // allow resubmission
  paid: [],
};
```

**Severity**: LOW -- mitigated by UI button visibility (only valid actions are shown), but no programmatic guard exists.

---

## Positive Findings (No Bug)

- **Autopilot locking**: `acquire_autopilot_lock` RPC uses atomic UPDATE with 5-minute stale window. Solid concurrency control.
- **Autopilot risk re-computation**: Server-side risk is re-computed from DB at execution time (line 547), not trusted from client. Good defense-in-depth.
- **Expense claim items**: CASCADE delete on `expense_claim_items_claim_id_fkey` -- deleting a claim safely removes items.
- **Expense delete guard**: UI only shows delete button for `draft` claims (line 287-289). Correct.
- **Leave request self-approval**: Already has both client-side guard (`useLeaveManagement.ts` line 120-124) AND DB trigger (`block_self_approval`). Model to follow.

---

## Summary Table

| ID | Severity | Module | Bug | Status |
|----|----------|--------|-----|--------|
| R13-1 | HIGH | Expense | Self-approval possible (no DB trigger + no UI guard) | New |
| R13-2 | MEDIUM | Autopilot | `reject_run` skips status validation | New |
| R13-3 | MEDIUM | Machines | No client-side input validation on `manageMachine` | New |
| R13-4 | LOW | Expense | No status transition validation | New |

---

## Implementation Plan

### Step 1: Fix R13-1 (HIGH) -- Expense self-approval block

**DB Migration**: Create trigger `block_expense_self_approval` on `expense_claims` that raises exception when `reviewed_by = profile_id` and status transitions to `approved` or `rejected`.

**UI Fix** (`ExpenseClaimsManager.tsx`): Get current user's profile ID and hide Approve/Reject buttons when `claim.profile_id === myProfileId`.

### Step 2: Fix R13-2 (MEDIUM) -- Autopilot reject_run status guard

**File**: `supabase/functions/autopilot-engine/index.ts`  
Add after line 384: `if (!["awaiting_approval", "approved"].includes(run.status)) return json({ error: "Cannot reject run in status: " + run.status }, 400);`

### Step 3: Fix R13-3 (MEDIUM) -- manageMachine input validation

**File**: `src/lib/manageMachineService.ts`  
Add pre-call validation for `machineId` (non-empty, not "null"), `qty` (non-negative), `outputQty` (non-negative), `scrapQty` (non-negative).

### Step 4: Fix R13-4 (LOW) -- Expense status transition validation

**File**: `src/hooks/useExpenseClaims.ts`  
Add `ALLOWED_EXPENSE_TRANSITIONS` map and validate in `updateClaim` before executing the DB update.

### Do NOT touch:
- `autopilot-engine` locking logic (solid)
- `leave_requests` triggers (already correct)
- `expense_claim_items` FK (CASCADE, correct)
- Any R7-R12 fixes

---

## Updated Technical Debt Score: 1.3/10

| Category | Score | Delta from R12 |
|----------|-------|----------------|
| Multi-tenant isolation | 9/10 | unchanged |
| Workflow integrity | 8/10 | +2 (R12 fixes holding) |
| Financial controls | 5/10 | NEW (expense self-approval gap) |
| Autopilot safety | 8/10 | -1 (reject_run no status check) |
| Input validation | 7/10 | NEW (manageMachine gap) |
| Data integrity | 9/10 | +1 (CASCADE confirmed) |

