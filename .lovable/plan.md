

## Plan: Fix Signature Pad Not Responding

### Root Cause
Two issues prevent the signature canvas from working:

1. **SignatureModal timing bug** — The canvas setup `useEffect` (line 42-52) runs when `open` changes, but the canvas is inside a Radix Dialog portal + TabsContent. The ref is `null` when the effect fires because the portal hasn't mounted yet. The drawing handlers silently fail since `canvasRef.current?.getContext("2d")` returns `null`.

2. **SignaturePad (shop floor)** — Same potential timing issue: the `useEffect` that sets `strokeStyle`, `lineWidth`, etc. runs on mount, but if the canvas isn't sized yet, drawing may produce invisible strokes.

### Fix 1: `src/components/delivery/SignatureModal.tsx`
- Add a small delay or use a `ref` callback to ensure the canvas is ready before configuring it
- Use `requestAnimationFrame` or a `setTimeout(0)` inside the canvas setup effect to wait for the Dialog portal to render
- Alternative (better): Replace the `useEffect` canvas setup with inline setup in `startDraw` — configure stroke properties right before drawing begins, guaranteeing the canvas exists

**Concrete change:** Move canvas context configuration (`strokeStyle`, `lineWidth`, etc.) into the `startDraw` function so it's set at draw-time, not in an effect:
```typescript
const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
  e.preventDefault();
  const ctx = canvasRef.current?.getContext("2d");
  if (!ctx) return;
  // Configure here instead of useEffect
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const p = getPos(e);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  setIsDrawing(true);
};
```
Remove the canvas setup `useEffect` (lines 42-52).

### Fix 2: `src/components/shopfloor/SignaturePad.tsx`
- Same pattern: move context configuration into `startDrawing` instead of relying on `useEffect`
```typescript
const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
  e.preventDefault();
  const ctx = getCtx();
  if (!ctx) return;
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const pos = getPos(e);
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y);
  setIsDrawing(true);
};
```
Remove the setup `useEffect` (lines 22-27).

### Technical Details
- The Radix Dialog renders content in a portal. React effects run synchronously after render, but the portal's DOM nodes may not be in the document yet
- `canvasRef.current` is `null` inside the effect → context config is skipped → strokes have default 1px width and may appear invisible or the `beginPath`/`lineTo` calls silently no-op
- Moving config to the event handler guarantees the canvas exists (since the user is interacting with it)

