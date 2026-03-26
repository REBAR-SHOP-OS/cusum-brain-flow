

# Fix Build Error + Enhance Visual Contrast for Ad Director UI

## Problem
1. **Build error** at line 617-618: mismatched closing tags/parentheses
2. **Visual contrast**: The content area (title, upload boxes, prompt bar) is too faint against the background video — needs stronger colors and backdrop

## Changes

### 1. `src/components/ad-director/AdDirectorContent.tsx` — Fix build error

Line 617-618 has a syntax issue with the closing `)}` and `</div>`. The `)}` on line 617 closes the result state conditional, then `</div>` on 618 closes the `z-10` wrapper div. Need to verify proper nesting — likely a missing or extra parenthesis from the previous edit.

### 2. `src/components/ad-director/AdDirectorContent.tsx` — Stronger overlay content area

In the idle state (lines 392-410), wrap the visible content in a backdrop panel:
- Add a `rounded-3xl bg-black/60 backdrop-blur-md border border-white/10 p-8` container around the title, upload boxes, and prompt bar
- This creates a visible "glass card" effect that makes content pop against the video

### 3. `src/components/ad-director/ChatPromptBar.tsx` — Boost upload box & input contrast

- **Upload boxes** (lines 158-161, 187-190, 216-219): Change `border-border/40 bg-muted/10` to `border-white/30 bg-white/10 backdrop-blur-sm` for better visibility
- **Text colors**: Change `text-muted-foreground/60` and `text-muted-foreground` on icons/labels to `text-white/70` and `text-white/80`
- **Input area** (line 242): Change `bg-card/60` to `bg-black/50 backdrop-blur-md border-white/20` for stronger contrast
- **Textarea placeholder**: Ensure white text on dark glass background
- **Bottom bar buttons**: Change `bg-muted/40 border-border` to `bg-white/10 border-white/20 text-white/80`

### 4. `src/components/ad-director/AdDirectorContent.tsx` — Title text contrast

- Title `h2` (line 397): Add `text-white` class
- Subtitle `p` (line 398): Change to `text-white/70`
- Icon container (line 394): Change to `bg-white/10`

| File | Change |
|---|---|
| `AdDirectorContent.tsx` | Fix build error, add glass-card wrapper, boost text colors to white |
| `ChatPromptBar.tsx` | Stronger backgrounds, white text/icons, better contrast on all elements |

