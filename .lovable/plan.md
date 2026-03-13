

# Add Animation, Cartoon & Painting styles

## Changes

### 1. `src/components/chat/ChatInput.tsx`
Add 3 new entries to `IMAGE_STYLES` array:
- `cartoon` — Cartoon style, icon: `Gamepad2` or `Smile`, color: `#a855f7` (purple)
- `animation` — Animation/3D style, icon: `Wand2`, color: `#8b5cf6`  
- `painting` — Painting/artistic style, icon: `Palette`, color: `#e11d48` (rose)

Import the needed Lucide icons (`Palette`, `Wand2`, `Clapperboard` or similar).

### 2. `supabase/functions/ai-agent/index.ts` — `IMAGE_STYLE_MAP`
Add 3 new style descriptions:
```
cartoon: "Cartoon style illustration, bold outlines, vibrant flat colors, exaggerated proportions, comic book aesthetic, clean vector-like rendering"
animation: "3D animated render, Pixar/Disney-quality, smooth surfaces, dramatic lighting, cinematic depth of field, stylized realism"
painting: "Oil painting style, visible brush strokes, rich color palette, artistic composition, impressionist or classical fine art aesthetic"
```

### 3. `supabase/functions/regenerate-post/index.ts` — same `IMAGE_STYLE_MAP`
Add the same 3 entries to keep maps in sync.

### Files
- `src/components/chat/ChatInput.tsx`
- `supabase/functions/ai-agent/index.ts`
- `supabase/functions/regenerate-post/index.ts`

