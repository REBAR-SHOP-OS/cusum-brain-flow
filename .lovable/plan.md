

## Fix: Text Overflowing in Blitz AI Panel

### Problem
Long text content from Blitz (especially bullet points with detailed action items) extends beyond the visible panel area, requiring horizontal scrolling. This is visible in the screenshot where sentences are cut off on the right edge.

### Root Cause
Two issues in `src/components/pipeline/PipelineAISheet.tsx` and `src/components/chat/RichMarkdown.tsx`:

1. The message bubble (line 336) uses `overflow-x-auto` which allows horizontal scroll instead of wrapping text
2. The `RichMarkdown` component's list items and paragraphs don't enforce word-breaking for long content
3. The agent message container has `max-w-[90%]` but no `overflow-hidden` or word-break rules

### Fix (2 files, surgical changes only)

**File 1: `src/components/pipeline/PipelineAISheet.tsx`**
- Line 336: Change `overflow-x-auto` to `overflow-hidden` and add `break-words` on the agent message div
- This ensures long text wraps within the panel instead of overflowing

**File 2: `src/components/chat/RichMarkdown.tsx`**
- Line 30: Add `break-words overflow-hidden` to the root wrapper div
- Line 118 (td): Add `break-words` to table cells so long text in tables wraps properly
- Line 130 (li): Add `min-w-0` to list items so flexbox children can shrink and wrap

### Scope
- No backend, edge function, layout, or other component changes
- Only affects text wrapping behavior inside the Blitz/Gauge AI panel

