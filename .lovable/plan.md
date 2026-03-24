

## Add Test Access for swapnil.m183@gmail.com

### What
Add `swapnil.m183@gmail.com` to the external estimators list with the same restriction as Karthick — Sales Pipeline only, "Estimation - Karthick" column only.

### Changes

**File**: `src/lib/accessPolicies.ts`
- Add `"swapnil.m183@gmail.com": ["estimation_karthick"]` to the `externalEstimators` map

**File**: `src/components/auth/RoleGuard.tsx`
- No changes needed — the external office routing already handles any non-internal email with an office role. However, since this test user may not have an "office" role assigned, we need to add a check: if the user's email is in `externalEstimators`, route them to `/sales/pipeline` directly.

### Files Changed

| File | Change |
|---|---|
| `src/lib/accessPolicies.ts` | Add `swapnil.m183@gmail.com` to `externalEstimators` |
| `src/components/auth/RoleGuard.tsx` | Add external estimator routing for users without office role |

