

# Fix: @Mentioned Users Must Receive Email Even If Not Assignees

## Problem

The `notify-lead-assignees` edge function only queries the `sales_lead_assignees` table for recipients. If you @mention a team member who is NOT assigned to the lead, they are never included in the recipient list and receive no email.

Current flow:
```text
1. Fetch assignees from sales_lead_assignees
2. For each assignee: if internal → include, if external → only if @mentioned
3. Send emails to filtered list
```

Missing: anyone @mentioned in the note who is NOT an assignee is completely invisible to the function.

## Fix

In `supabase/functions/notify-lead-assignees/index.ts`, after building the assignee-based recipient list, extract all `@Name` mentions from the note text and look up matching profiles. Add any matched profiles that aren't already in the recipient list (and aren't the actor).

### Logic
```text
1. Build assignee recipient list (existing logic — unchanged)
2. Extract all @mentions from note_text using regex
3. Query profiles table for matching full_name values
4. For each matched profile:
   - Skip if already in recipients
   - Skip if they are the actor
   - Add to recipients
5. Send emails to combined list
```

### Implementation detail

- Parse mentions: `note_text.match(/@([A-Za-z\s]+?)(?=\s@|\s*$|[.,!?])/g)` to extract names after `@`
- Query `profiles` with `.in('full_name', mentionedNames)` filtered to the same company
- Only internal (`@rebar.shop`) mentioned users get auto-included; external mentioned users who are assignees already work via existing logic

## Files Changed

| File | Change |
|---|---|
| `supabase/functions/notify-lead-assignees/index.ts` | After assignee loop, extract @mentions from note_text, query matching profiles, add to recipients if not already present |

