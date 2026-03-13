

# Add Vertical (9:16) Aspect Ratio + Button-Style Icons

## Changes

### 1. `src/components/chat/ChatInput.tsx`
- Import `RectangleVertical` from lucide-react
- Add a third button for "9:16" portrait/vertical ratio
- Restyle all three buttons to look like proper pill/tab buttons with text labels instead of just icon-only toggles:
  - Horizontal: `RectangleHorizontal` icon + "16:9" label
  - Square: `Square` icon + "1:1" label  
  - Vertical: `RectangleVertical` icon + "9:16" label
- Each button gets rounded-full pill styling with bg fill when active

### 2. `supabase/functions/ai-agent/index.ts`
- Update aspect ratio instruction to handle "9:16": `"Generate this image in VERTICAL 9:16 portrait format (taller than wide, suitable for Stories/Reels)."`
- Update OpenAI size mapping: "9:16" → `"1024x1536"`

### 3. `supabase/functions/regenerate-post/index.ts`
- Same "9:16" handling as ai-agent

