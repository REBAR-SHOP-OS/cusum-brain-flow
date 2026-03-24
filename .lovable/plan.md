

## Add Karthick as External Estimator with Restricted Sales Pipeline Access

### What
Add `info@mavericksrebar.com` (Karthick) as an external user who can only access the Sales Pipeline (`/sales/pipeline`) and only see the **Estimation - Karthick** column. He should not see any other columns or other Sales sub-pages.

### Changes

**File**: `src/components/auth/RoleGuard.tsx`
- Add `/sales/pipeline` to `EXTERNAL_OFFICE_ALLOWED` so office-role external users (Karthick) can access the Sales Pipeline route

**File**: `src/pages/sales/SalesPipeline.tsx`
- Import `useAuth` to get the current user's email
- Add a stage filter: if the user's email is `info@mavericksrebar.com`, override `visibleStageIds` to only show `["estimation_karthick"]`
- Hide the `+ New` button and stage group filter chips for this user (read-only estimator view)

**File**: `src/lib/accessPolicies.ts`
- Add a new policy entry `externalEstimators` mapping emails to their allowed stages:
  ```typescript
  externalEstimators: {
    "info@mavericksrebar.com": ["estimation_karthick"],
  } as Record<string, string[]>,
  ```

### Files Changed

| File | Change |
|---|---|
| `src/lib/accessPolicies.ts` | Add `externalEstimators` policy map |
| `src/components/auth/RoleGuard.tsx` | Add `/sales/pipeline` to external office allowed routes |
| `src/pages/sales/SalesPipeline.tsx` | Filter visible stages for external estimators, hide create button |

