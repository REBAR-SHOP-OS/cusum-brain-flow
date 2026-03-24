

## Hide Details Tab & Schedule Activity for External Estimators

### Changes

**File**: `src/components/sales/SalesLeadDrawer.tsx` (line 236)
- Change tab list from `["timeline", "details"]` to dynamically exclude "details" for external estimators:
  ```tsx
  {(["timeline", ...(isExternalEstimator ? [] : ["details"])] as const).map((tab) => (
  ```

**File**: `src/components/sales/SalesLeadChatter.tsx` (line 240)
- Change action buttons from `["note", "activity"]` to exclude "activity" for external estimators:
  ```tsx
  {(["note", ...(isExternalEstimator ? [] : ["activity"])] as const).map((tab) => (
  ```

| File | Change |
|---|---|
| `SalesLeadDrawer.tsx` | Hide "Details" tab for external estimators |
| `SalesLeadChatter.tsx` | Hide "Schedule activity" button for external estimators |

