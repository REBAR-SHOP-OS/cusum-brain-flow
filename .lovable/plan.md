

## Add Vendors to Mentions & Filter Activities for 3rd Party Users

### Problem
1. The `@` mention menu only shows `@rebar.shop` users — 3rd party assignees (vendors) on the lead cannot be mentioned
2. External estimators (3rd party) can see ALL notes/activities on a lead — they should only see activities where they are explicitly `@mentioned`

### Changes

**File: `src/components/chat/MentionMenu.tsx`**
- Accept optional `extraUsers` prop: `{ id: string; label: string; subtitle?: string }[]`
- After loading `@rebar.shop` profiles, append `extraUsers` to the items list (filtered by `mentionFilter`)
- This allows the chatter to pass lead assignees who are non-rebar users

**File: `src/components/sales/SalesLeadChatter.tsx`**
- Accept new props: `isExternalEstimator?: boolean`, `currentUserEmail?: string`, `assignees?: { profile_id: string; full_name: string }[]`
- Pass non-`@rebar.shop` assignees as `extraUsers` to `MentionMenu`
- When `isExternalEstimator` is true, filter `activities` client-side to only show items where `body` or `subject` contains `@CurrentUserName` (matched by email/name from assignees list)
- Also always show activities created by the current user themselves

**File: `src/components/sales/SalesLeadDrawer.tsx`**
- Pass `isExternalEstimator`, `assignees`, and current user email to `SalesLeadChatter`

### Files Changed

| File | Change |
|---|---|
| `src/components/chat/MentionMenu.tsx` | Add `extraUsers` prop, merge with rebar profiles |
| `src/components/sales/SalesLeadChatter.tsx` | Pass vendor assignees to MentionMenu; filter activities for 3rd party to only @mentioned ones |
| `src/components/sales/SalesLeadDrawer.tsx` | Forward `isExternalEstimator`, `assignees`, user email to chatter |

