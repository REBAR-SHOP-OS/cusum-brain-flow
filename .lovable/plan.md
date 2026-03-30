

# Create 5 Placeholder Cards on Auto-Generate Click

## Problem
When "Auto-generate" is clicked, nothing appears in the calendar until the edge function finishes (60-120s). User wants 5 instant placeholder cards with "?" at specific times.

## Plan

### File: `src/hooks/useAutoGenerate.ts`

1. **Before calling the edge function**, immediately insert 5 placeholder rows into `social_posts` via `supabase.from("social_posts").insert(...)`:
   - Each with `status: "draft"`, `title: "?"`, `body: ""`, `platform: "unassigned"`
   - Scheduled for the target date at these times: **6:30am, 7:30am, 8:00am, 12:30pm, 2:30pm**
   - Get `user_id` from current session (`supabase.auth.getUser()`)
   - Store the 5 created IDs so the edge function can update/replace them

2. **Invalidate the query** immediately after insert so the calendar shows the 5 "?" cards right away

3. **Pass placeholder IDs** to the edge function in the request body so it can update these rows instead of creating new ones (or if the edge function ignores them, the placeholders remain as drafts to be edited)

### File: `supabase/functions/auto-generate-post/index.ts`

4. **Accept optional `placeholderIds`** in the request body — if provided, update those rows with generated content instead of inserting new ones. If not provided, create new rows as before (backward compatible).

## Result
- User clicks "Auto-generate" → 5 cards with "?" appear instantly at the 5 time slots
- Edge function runs in background and fills in real content
- Calendar feels responsive instead of empty during generation

## Files Changed
- `src/hooks/useAutoGenerate.ts` — insert 5 placeholder rows before edge function call
- `supabase/functions/auto-generate-post/index.ts` — accept and update placeholder IDs

