

# Fix Scrolling and File Analysis in App Builder

## Issue 1: Page Doesn't Scroll

**Root cause**: The outer container at line 236 uses `min-h-screen` but the App Layout wrapper already provides a full-height container. The `min-h-screen` causes the empire page to overflow its parent without proper scroll containment. The hero section uses `overflow-y-auto` correctly, but the overall wrapper needs `h-screen` (or the parent's full height) instead of `min-h-screen` to create a proper scroll boundary.

**Fix** in `src/pages/EmpireBuilder.tsx`:
- Line 236: Change `min-h-screen` to `h-screen overflow-hidden` on the outer wrapper so the page fills exactly the available space and doesn't overflow
- This lets the inner `overflow-y-auto` sections (hero and chat) scroll properly within their bounds

## Issue 2: File Analysis Crashes with "Maximum call stack size exceeded"

**Root cause**: In `supabase/functions/ai-agent/index.ts` line 57, the code does:
```
btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
```
The spread operator (`...`) passes every byte as a separate argument to `String.fromCharCode()`. For a 5MB PDF, that's ~5 million arguments, which blows the call stack.

**Fix** in `supabase/functions/ai-agent/index.ts`:
- Replace the one-liner base64 conversion with a chunked approach that processes the bytes in batches of 8192:
```typescript
const bytes = new Uint8Array(arrayBuffer);
let binary = "";
for (let i = 0; i < bytes.length; i += 8192) {
  binary += String.fromCharCode(...bytes.slice(i, i + 8192));
}
const base64 = btoa(binary);
```
- This prevents the stack overflow while producing identical output

## Files to Modify

| File | Change |
|---|---|
| `src/pages/EmpireBuilder.tsx` | Change outer div from `min-h-screen` to `h-screen overflow-hidden` |
| `supabase/functions/ai-agent/index.ts` | Replace spread-based base64 conversion with chunked loop |

