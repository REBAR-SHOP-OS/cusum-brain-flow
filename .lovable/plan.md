

# Auto-Add @Mentioned Users to Assignees

## Problem
When users @mention someone in a sales lead note, that person is NOT automatically added as an assignee on the lead. They should be.

## Approach
After a note is successfully logged, parse the note text for @mentions, resolve each mentioned name to a profile ID, and call `addAssignee` for any that aren't already assigned.

## Changes

### `src/components/sales/SalesLeadChatter.tsx`
1. Add new prop `onAddAssignee?: (profileId: string) => void`
2. Add new prop `allProfiles?: Profile[]` (to resolve mention names to profile IDs)
3. In `handleSubmit` → `onSuccess` for notes: extract all `@Full Name` patterns from text, match against `allProfiles`, and call `onAddAssignee(profileId)` for each match not already in `assignees`

### `src/components/sales/SalesLeadDrawer.tsx`
1. Pass `onAddAssignee` and `allProfiles` (profiles) down to `<SalesLeadChatter>`

### `src/pages/sales/SalesPipeline.tsx`
Already passes `onAddAssignee` to the drawer — no change needed here.

## Logic Detail
```
// After note is logged successfully:
const mentionRegex = /@([A-Za-z\u0600-\u06FF\s]+?)(?=\s@|\s*$)/g;
for each match:
  find profile where full_name matches (case-insensitive trim)
  if profile found AND not already in assignees:
    onAddAssignee(profile.id)
```

| File | Change |
|---|---|
| `SalesLeadChatter.tsx` | Add `onAddAssignee` + `allProfiles` props; auto-add mentioned users on note submit |
| `SalesLeadDrawer.tsx` | Pass `onAddAssignee` and `profiles` to SalesLeadChatter |

