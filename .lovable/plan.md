
# Investigation Finding: LeadFormModal Fields Are Already Select Dropdowns

## What Was Found

After a thorough audit of every file in `src/pages/Pipeline.tsx`, `src/components/pipeline/`, and a live screenshot session opening the Edit Lead modal, the result is definitive:

**The Stage, Priority, Lead Type, and Source fields in the Edit Lead modal already use Radix UI `<Select>` dropdown components — not plain `<Input>` text fields.**

There is no "Status" field in the current lead form. The four fields that correspond to the user's description are:

| User's label | Actual field name | Current component |
|---|---|---|
| Stage | `stage` | Radix `<Select>` ✓ |
| Priority | `priority` | Radix `<Select>` ✓ |
| Type | `lead_type` | Radix `<Select>` ✓ |
| Status | (missing) | Does not exist |
| Source | `source` | Radix `<Select>` ✓ |

## Why They May Look Like Text Inputs

The Radix UI `SelectTrigger` renders as a `<button>` styled to look like a bordered input box. Without a clear chevron icon that stands out visually, it can be difficult to tell it apart from a plain `<Input>` — especially in screenshots or smaller screen sizes. Looking at the edit modal screenshot: the dropdowns do have a small `ChevronDown` icon on the right, but it's subtle and blends in.

## The Fix

The visual distinction can be improved by adding `font-medium` and `text-foreground` explicitly to each `SelectTrigger` in `LeadFormModal.tsx`, making it clearer these are interactive dropdowns. Additionally, a missing "Status" field (win/loss/open) can be added if that is what was intended.

However, the strictly scoped surgical fix is: **the components are already correct**. No plain `<Input>` elements need to be converted. The change requested has already been implemented.

## What Will Be Done

Since the fields ARE already dropdowns (Radix Select), and the request says to convert text inputs to dropdowns, the plan is to confirm this and make the dropdowns visually stronger so they clearly read as interactive Select controls — not text boxes:

**File:** `src/components/pipeline/LeadFormModal.tsx`

Add `className` to each `SelectTrigger` to make them visually unmistakable as dropdowns by giving the trigger a slightly contrasting background and bolder chevron treatment:

```tsx
<SelectTrigger className="bg-background border-input">
```

This ensures the dropdown trigger has a visually distinct border and background, making it unmistakable as a select control rather than a read-only text field.

## Scope

| File | Change |
|---|---|
| `src/components/pipeline/LeadFormModal.tsx` | Add explicit `className` to each `SelectTrigger` for visual clarity |

## What Is NOT Changed
- The underlying `<Select>`, `<SelectContent>`, or `<SelectItem>` logic — these are already correct
- The database queries, mutations, form validation schema
- Any other pipeline component (PipelineBoard, LeadDetailDrawer, PipelineFilters)
- Any other page or route
