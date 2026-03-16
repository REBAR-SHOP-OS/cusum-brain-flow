

# Fix: 9:16 Aspect Ratio Not Applied to Generated Images

## Root Cause

The logs confirm: `[imageResize] Cropped 1024x1024 → 1024x1024 → resized to 1024x1024 (ratio: 1:1)`

The user selected 9:16 but the image was cropped to 1:1. Two cascading failures:

1. **Agent tool call unreliable**: Line 610 resolves aspect ratio as `args.aspect_ratio || context?.imageAspectRatio || "1:1"`. The Gemini agent often omits `aspect_ratio` from its tool call args, so it falls back to context. But `context` here refers to the tool executor's `context` parameter — need to verify it carries `imageAspectRatio`.

2. **Gemini image models ignore aspect ratio**: Even with prompt instructions like "generate a PORTRAIT 9:16 image", Gemini consistently outputs 1024x1024 square images. The `cropToAspectRatio` function should fix this, but only if `aspectRatio` is correctly set to "9:16" — which it wasn't (it was "1:1").

## Fix — `supabase/functions/_shared/agentToolExecutor.ts`

### Change 1: Force aspect ratio from context (line ~610)
The current code:
```ts
const aspectRatio = args.aspect_ratio || (context?.imageAspectRatio as string) || "1:1";
```

The problem is that `context` at this point may not contain `imageAspectRatio` directly. The agent receives it in the system prompt but the executor gets a separate `context` object. Need to ensure the context is threaded correctly.

**Add a log line** after line 610 to trace the actual value:
```ts
console.log(`[generate_image] aspectRatio resolved: args=${args.aspect_ratio}, context=${context?.imageAspectRatio}, final=${aspectRatio}`);
```

### Change 2: Always prefer context over agent args
Reverse the priority — context is the user's explicit UI selection, more reliable than what the AI decides to pass:
```ts
const aspectRatio = (context?.imageAspectRatio as string) || args.aspect_ratio || "1:1";
```

### Change 3: Add dimension hints to the API request
Gemini image models support `image_size` parameter. Add explicit dimensions:
```ts
const DIMENSIONS: Record<string, {width: number, height: number}> = {
  "16:9": { width: 1536, height: 864 },
  "9:16": { width: 864, height: 1536 },
  "1:1": { width: 1024, height: 1024 },
};
// In the fetch body:
...(DIMENSIONS[aspectRatio] ? { image_size: DIMENSIONS[aspectRatio] } : {}),
```

### Change 4: Ensure fallback retry also applies correct crop
In the fallback block (line 797+), the crop still uses the original `aspectRatio` variable, which is correct — but verify it doesn't get overwritten.

## Files to Edit

- `supabase/functions/_shared/agentToolExecutor.ts` — Fix aspect ratio resolution priority, add dimension hints, add debug logging

