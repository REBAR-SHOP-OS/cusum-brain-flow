
## Goal
Make internal email mentions like `@name@rebar.shop` automatically add that person to the lead’s Assignee list instead of ignoring them.

## Root cause
The current implementation was built around `@Full Name`, not `@email@rebar.shop`:

1. `SalesLeadChatter.tsx` only parses mentions with a regex that allows letters/spaces, so email-style mentions are ignored.
2. The mention input logic uses `@\w*$`, which does not properly support email fragments.
3. The backend notification function also extracts mentions as names only, so internal email mentions are not resolved there either.

## Plan

### 1) Support internal email mentions in the sales note composer
Update `src/components/sales/SalesLeadChatter.tsx` so mention parsing accepts both:
- `@Full Name`
- `@user@rebar.shop`

This includes:
- replacing the current narrow regex with a parser that can detect email-style internal mentions
- resolving mentions against `allProfiles` by either:
  - exact internal email match, or
  - fallback full name match
- calling `onAddAssignee(profile.id)` for any matched internal profile not already assigned

### 2) Make the mention typing/select flow compatible with email mentions
Still in `SalesLeadChatter.tsx`:
- update the active mention detection so typing after `@` can include `.` and `@`
- update mention insertion logic so selected internal users can be inserted in a format that is reliably parseable
- keep existing name mention support working

### 3) Fix backend mention resolution for notifications
Update `supabase/functions/notify-lead-assignees/index.ts` so the backend also recognizes internal email mentions:
- parse `@...@rebar.shop` mentions from `note_text`
- resolve those directly by `profiles.email`
- keep the existing name-based resolution as fallback
- continue auto-adding matched internal users to `sales_lead_assignees` server-side as a safety net

### 4) Keep assignee behavior deterministic
Use this rule:
- if mention matches an internal `@rebar.shop` email, add to assignees
- if mention matches a full name, add to assignees
- ignore unmatched text safely
- avoid duplicate assignee inserts

## Files to update
- `src/components/sales/SalesLeadChatter.tsx`
- `supabase/functions/notify-lead-assignees/index.ts`

## Technical details
```text
Current bug:
@neel@rebar.shop
  -> front-end regex rejects it
  -> assignee auto-add never runs for that user
  -> backend name-only regex also misses it

Target behavior:
User writes note with @someone@rebar.shop
  -> note saves
  -> email mention resolves to internal profile
  -> assignee is added if missing
  -> notification flow uses same resolution path
```

## Validation
After implementation, verify these cases:
1. Mention `@full name` → assignee added
2. Mention `@user@rebar.shop` → assignee added
3. Mention same person twice → only one assignee chip
4. Unknown email mention → no crash, no duplicate/bad insert
5. Existing notification email flow still works
