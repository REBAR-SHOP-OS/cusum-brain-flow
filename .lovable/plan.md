

## Disable Purchasing Interactions Until Date Is Selected

### Problem
Users can currently click items (mark purchased, reject, add) without first selecting a date. This causes items to be saved without a `due_date`, leading to data inconsistency.

### Changes

**1. UI: `src/components/purchasing/PurchasingListPanel.tsx`**
- When `filterDate` is undefined, disable the add form (inputs + button) and overlay the items list with a message like "Please select a date first" with a calendar icon
- The add button and item interaction buttons should be non-functional until a date is chosen
- Keep the calendar picker and header always active

**2. Agent prompt: `supabase/functions/_shared/agents/purchasing.ts`**
- Add a rule to the system prompt: "If the user has not selected a date yet (no due_date context), tell them to select a date from the calendar before adding or modifying items."

**3. Component: `src/components/purchasing/CompanyDefaultItems.tsx`**
- Accept a `disabled` prop; when true, all check/reject/delete buttons are disabled (grayed out, no pointer events)

### Result
Until a date is selected via the calendar picker, the entire purchasing list is visually locked with a clear message prompting the user to pick a date first. The agent also instructs users to select a date before proceeding.

