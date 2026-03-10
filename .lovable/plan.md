

# Fix: Mapped → Validated → Approved Flow

## Problem
After clicking Validate, the session status becomes `"validated"` but `getStepIndex` still returns 4 (same step). The Validate button remains visible alongside Optimize, creating confusion. The user must manually figure out to click Optimize, then Approve. No auto-progression occurs.

## Root Issues
1. **Validate button has no status guard** — shows at step 4 even when already validated
2. **Optimize button requires blockerCount === 0** — correct, but appears alongside Validate with no visual distinction
3. **No auto-advance after validation** — user is left at same visual state

## Fix (single file: `src/components/office/AIExtractView.tsx`)

### 1. Guard Validate button against already-validated status
Line 1344: Change `currentStepIndex === 4` to `currentStepIndex === 4 && activeSession?.status !== "validated"`

This hides Validate once validation has run, leaving only the Optimize button visible.

### 2. Add "Validated" success badge when status is validated
After the Validate button block, add a badge showing "Validation Passed" when `activeSession?.status === "validated" && !isOptimizing` — so the user sees confirmation before clicking Optimize.

### 3. Auto-trigger optimization after successful validation
In `handleValidate`, after validation succeeds with `can_approve === true`, automatically call `handleStartOptimize()` — eliminating the manual Optimize click and taking the user straight to the Approve step.

This creates a smooth flow: **Apply Mapping** → click **Validate** → auto-runs **Optimize** → user sees cut plans → clicks **Approve**.

### 4. Show "Validated" badge in the mapping-complete area
When `activeSession?.status === "validated"`, show a "Validated" badge alongside "Mapping Complete".

## Result
- Mapped → click Validate → auto-optimizes → Approve button appears
- No dead-end states
- Validate button hidden once done
- Single file, ~15 lines changed

