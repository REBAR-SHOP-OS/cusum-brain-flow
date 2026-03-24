

## Hide Sensitive Fields from 3rd Party Vendors

### Change

**File**: `src/components/sales/SalesLeadDrawer.tsx`

1. **Stage ribbon (lines 108-126)**: Wrap in `{!isExternalEstimator && (...)}`
2. **Email field (lines 144-150)**: Add `!isExternalEstimator &&` to the existing condition
3. **Phone field (lines 152-158)**: Add `!isExternalEstimator &&` to the existing condition
4. **Assignees section (lines 174-184)**: Wrap in `{!isExternalEstimator && (...)}`

### Result
External estimators see only: title, priority badge, contact name, company name, expected value, source, timeline/details tabs. Stage controls, email, phone, and assignee chips are hidden.

| File | Change |
|---|---|
| `src/components/sales/SalesLeadDrawer.tsx` | Guard 4 sections with `!isExternalEstimator` |

