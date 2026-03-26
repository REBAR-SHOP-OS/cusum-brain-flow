

# Fix: Image Editing "corsHeaders is not defined" Error

## Problem
The `generate-image` edge function uses `corsHeaders` in every response but **never imports it**. The `handleRequest` wrapper handles CORS for the happy path, but any early-return error response (e.g., missing prompt, missing API key) directly references `corsHeaders`, causing a `ReferenceError: corsHeaders is not defined` at runtime.

## Fix

### `supabase/functions/generate-image/index.ts` — Line 2
Add the missing import:
```typescript
import { corsHeaders } from "../_shared/auth.ts";
```

This single line fixes all ~20 references to `corsHeaders` throughout the file. No other changes needed.

| File | Change |
|---|---|
| `supabase/functions/generate-image/index.ts` | Add `import { corsHeaders } from "../_shared/auth.ts";` after line 2 |

