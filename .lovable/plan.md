

## Fix Brain Overlay & Page Layout — AI Extract View

### Problem
The brain processing overlay still shows a visible dark rectangle around the brain image. The `mix-blend-mode: screen` isn't enough because the backdrop behind it (`bg-background/60`) is dark, so there's nothing bright to blend against. The page also looks cluttered with content bleeding.

### Solution

**File: `src/components/office/AIExtractView.tsx`**

#### 1. Fix the brain black square (lines 516-526)
Use a **radial `mask-image`** gradient to fade the brain's edges to transparent — the same proven technique used in `InteractiveBrainBg.tsx`. This completely eliminates the hard rectangular boundary regardless of backdrop color.

```tsx
<img
  src={brainHero}
  alt=""
  className="relative w-[35vh] h-[35vh] max-w-[400px] max-h-[400px] object-contain opacity-80 select-none"
  draggable={false}
  style={{
    mixBlendMode: "screen",
    filter: "drop-shadow(0 0 60px hsl(var(--primary) / 0.5))",
    animation: "brain-extract-float 4s ease-in-out infinite",
    maskImage: "radial-gradient(circle, white 30%, transparent 70%)",
    WebkitMaskImage: "radial-gradient(circle, white 30%, transparent 70%)",
  }}
/>
```

Key additions:
- `maskImage` + `WebkitMaskImage` — fades the rectangular edges to invisible
- Slightly smaller size (`35vh` / `400px` max) so it doesn't dominate the view

#### 2. Improve the backdrop (line 504)
Make the backdrop darker and blurrier so the brain glow pops against it:
```tsx
<div className="absolute inset-0 bg-background/85 backdrop-blur-md" />
```

#### 3. Ensure page fits without overflow (line 551-552)
The outer container already uses `h-full` + `ScrollArea`, which is correct for the `AppLayout` pattern. No structural changes needed there.

### Summary of edits
- **Lines 504**: Backdrop → `bg-background/85 backdrop-blur-md`
- **Lines 516-526**: Add `maskImage`/`WebkitMaskImage` radial gradient, adjust size down slightly
- No other file changes needed

