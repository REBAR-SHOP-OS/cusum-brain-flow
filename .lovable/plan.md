

# Fix: "aspectRatio is not defined" Error in Video Generation

## Root Cause

Two bugs:

1. **Edge function Zod schema** (`supabase/functions/generate-video/index.ts` line 531-549) does not include `aspectRatio` field, so it's never parsed from the request body.
2. **Client** (`VideoStudioContent.tsx` lines 444-470) never sends `aspectRatio` in the payload to the edge function — it's missing from both the single-clip and multi-scene `invokeEdgeFunction` calls.

The variable `aspectRatio` is referenced at lines 657 and 659 when calling `wanGenerate()` and `wanI2vGenerate()`, but since it was never destructured from the parsed body, it's `undefined` at runtime, causing the error.

## Fix

### 1. Edge function schema — add `aspectRatio` field
Add `aspectRatio: z.string().max(10).optional()` to the Zod schema, and destructure it from `parsed.data`.

### 2. Client — send `aspectRatio` in all generate payloads
Add `aspectRatio` to the `invokeEdgeFunction("generate-video", { ... })` calls for both single-clip and multi-scene generation paths (lines ~444 and ~466), and also in the re-generate call (~829).

### 3. Bonus: also send in multi-scene generate
The multi-scene path also needs `aspectRatio` for Wan to pick the correct resolution.

## Files Changed
- `supabase/functions/generate-video/index.ts` — 2 lines (schema + destructure)
- `src/components/social/VideoStudioContent.tsx` — add `aspectRatio` to 3-4 invoke calls

