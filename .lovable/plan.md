
# Fix: Annotation Strokes Invisible / Too Thin on Feedback Screenshot

## Scope
Single file: `src/components/feedback/AnnotationOverlay.tsx`
Two constants only. No other files, no database, no other components touched.

## Root Cause

The canvas is loaded at its **natural image resolution** (e.g. 1920×1080 from html2canvas) but displayed CSS-scaled down to fit the dialog (≈900px wide on a 10" tablet).

The stroke is drawn using `LINE_WIDTH = 3` in **canvas pixel space**. Due to the scale-down:

```
visible_stroke = LINE_WIDTH × (display_width / canvas_width)
               = 3 × (900 / 1920)
               ≈ 1.4 px
```

A 1.4px red line on a busy screenshot is nearly invisible. This is the exact cause of the reported issue.

Additionally, `lineCap: "round"` and `lineJoin: "round"` are already set correctly — only the thickness needs fixing.

## The Fix

### Change 1 — Increase `LINE_WIDTH` constant (line 12)
```diff
- const LINE_WIDTH = 3;
+ const LINE_WIDTH = 8;
```
An 8px canvas-space stroke renders at `8 × (900/1920)` ≈ **3.75px** on screen — bold and clearly visible on any screenshot.

### Change 2 — Add a minimum stroke enforcer in `startDraw` (line 104)
To make strokes scale-aware regardless of screenshot size, compute a minimum effective width based on the current canvas-to-display ratio:

```diff
  ctx.strokeStyle = color;
- ctx.lineWidth = LINE_WIDTH;
+ const canvas = canvasRef.current!;
+ const rect = canvas.getBoundingClientRect();
+ const scale = canvas.width / rect.width;
+ ctx.lineWidth = Math.max(LINE_WIDTH, Math.round(4 * scale));
```

This ensures:
- On a 1920px canvas displayed at 900px: `scale = 2.13` → lineWidth = `max(8, 9)` = **9px** (≈4.2px visible)
- On a 500px canvas displayed at 500px: `scale = 1` → lineWidth = `max(8, 4)` = **8px** (8px visible)
- The rendered stroke is always at least ~4px thick on screen regardless of screenshot resolution

## Summary of Changes

| Line | Change |
|------|--------|
| 12 | `LINE_WIDTH = 3` → `LINE_WIDTH = 8` |
| 104–106 | Replace `ctx.lineWidth = LINE_WIDTH` with scale-aware computation |

## No Other Changes
- No other files modified
- No database changes
- No UI layout, component structure, or feature logic outside these two spots is altered
