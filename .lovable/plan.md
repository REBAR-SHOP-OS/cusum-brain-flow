

# Fix: Persian Translation Not Displaying in Post Review Panel

## Problem
When a post is approved from the Pixel agent chat, the Persian translation block (`---PERSIAN---`) is stripped from the content before saving to the database. As a result, the PostReviewPanel can never parse it back, and always shows "ترجمه‌ای موجود نیست" (No translation available).

## Root Cause
In `src/pages/AgentWorkspace.tsx`, the `handleApprovePost` function (lines 528-532) explicitly removes the Persian block from the caption before inserting into `social_posts`. The `content` field in DB never contains the `---PERSIAN---` section. The PostReviewPanel parsing logic (lines 226-238) correctly looks for it but finds nothing.

## Solution

### File: `src/pages/AgentWorkspace.tsx`

**Preserve the Persian block in `content`**:
- Before the cleaning steps, extract the Persian block from `rawCaption`
- Clean the English portion as currently done (remove image markdown, contact info, etc.)
- After cleaning, **re-append** the extracted Persian block to the final `content` value before insert
- This matches exactly what `PostReviewPanel.flushSave` does (line 308-312)

Specifically:
1. Before line 529, extract the Persian block: `const persianBlock = persianIdx !== -1 ? rawCaption.slice(persianIdx) : ""`
2. Continue cleaning the English part as before
3. At line 556 where `content` is set, append: `const content = cleanCaption + (persianBlock ? "\n\n" + persianBlock : "")`

## Result
- Persian image text and caption translation will be preserved in DB
- PostReviewPanel will correctly parse and display them
- The English editable textarea still won't show Persian (already handled by stripping before display)
- Publishing still strips Persian (handled by `usePublishPost.ts`)

## Files Changed
- `src/pages/AgentWorkspace.tsx` — preserve Persian block during post approval

