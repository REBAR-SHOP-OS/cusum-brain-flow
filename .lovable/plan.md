

# Fix Caption Order & Persian Translation Display

## Problem
1. Caption order is wrong: currently Caption → Hashtags → Contact → Persian. Should be: **Caption → Contact → Hashtags**
2. Persian translation block is visible in the review panel content card — should be in a separate collapsible box, never mixed with publishable content
3. AI prompt should forbid "guarantee" type words

## Changes

### 1. `supabase/functions/ai-agent/index.ts` — Fix content order + prompt rule
- **Line 94**: Add rule: "NEVER use words like 'guarantee', 'warranty', 'certified', or legally binding claims"
- **Lines 629-631**: Change order from `Caption → Hashtags → Contact → Persian` to `Caption → Contact → Hashtags → Persian`

### 2. `supabase/functions/regenerate-post/index.ts` — Fix content order
- **Line 270**: Change `caption + hashtags + contact + persian` to `caption + contact + hashtags + persian`
- **Line 412**: Same fix

### 3. `src/components/social/PostReviewPanel.tsx` — Separate Persian translation display
- **Lines 476-489**: Split content display into:
  - Main content card: Strip Persian block, show only English text (caption + contact + hashtags) in correct order
  - Collapsible "Persian Translation" box below: Extract and display the `---PERSIAN---` block in a separate bordered card with RTL direction, collapsed by default
  - Use `Collapsible` from radix for the translation box

### 4. `src/hooks/usePublishPost.ts` — Already strips Persian (no change needed, just verify)

### 5. `src/pages/AgentWorkspace.tsx` — Already strips Persian on save (no change needed)

## Files Changed
- `supabase/functions/ai-agent/index.ts`
- `supabase/functions/regenerate-post/index.ts`
- `src/components/social/PostReviewPanel.tsx`

