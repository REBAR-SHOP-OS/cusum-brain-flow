

## Plan: Single Image Per Request + Collapsible Persian Translation

### Problem
1. The Pixel agent sometimes generates 2 images per chat message instead of 1
2. The Persian translation block is always visible — should be a small collapsible icon/button

### Changes

**1. `supabase/functions/_shared/agents/marketing.ts` (prompt update)**
- Add an explicit rule near the top: "CRITICAL: Generate EXACTLY ONE image per user message. Never call `generate_image` more than once unless the user explicitly says 'all' or gives multiple slot numbers. One message = one image + one caption."
- Update the "WHEN USER SENDS A SHORT CREATION COMMAND" section to reinforce: "Call `generate_image` exactly ONCE."

**2. `src/components/social/PixelPostCard.tsx` (UI update)**
- Replace the always-visible Persian translation box (lines 108-124) with a collapsible section:
  - Show a small icon button (e.g., a globe/translate icon) labeled "🇮🇷" or with a translate icon
  - On click, toggle the Persian translation content visibility
  - When collapsed (default), only the small icon is visible
  - When expanded, show the same translation content as before

### Files
- `supabase/functions/_shared/agents/marketing.ts`
- `src/components/social/PixelPostCard.tsx`

