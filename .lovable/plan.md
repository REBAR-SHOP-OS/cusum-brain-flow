

## Plan: Fix `extract-manifest` Boot Crash (Deno Import Error)

### Problem
The `extract-manifest` edge function returns **503** on every call because it fails to boot. The error:

```
Uncaught SyntaxError: The requested module 'https://deno.land/std@0.190.0/encoding/base64.ts' does not provide an export named 'encode'
```

### Root cause
Line 2 of `supabase/functions/extract-manifest/index.ts` imports `{ encode as base64Encode }` from `https://deno.land/std@0.190.0/encoding/base64.ts`. That module's export was renamed/removed in the Deno standard library. The function crashes before any handler code runs.

### Fix

**File: `supabase/functions/extract-manifest/index.ts`** — Line 2

Replace:
```typescript
import { encode as base64Encode } from "https://deno.land/std@0.190.0/encoding/base64.ts";
```

With the native Deno `btoa` + `Uint8Array` approach (no external dependency):
```typescript
// Use built-in btoa for base64 encoding — no external import needed
```

Then replace any usage of `base64Encode(bytes)` in the file with the built-in equivalent:
```typescript
const base64 = btoa(String.fromCharCode(...new Uint8Array(bytes)));
```

Or if the byte arrays are large (to avoid stack overflow), use the same chunked approach already used in `ai-document-import`:
```typescript
let binary = "";
const chunk = 8192;
for (let i = 0; i < bytes.length; i += chunk) {
  binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
}
const base64 = btoa(binary);
```

### Scope
- Remove the broken import on line 2
- Find all usages of `base64Encode` in the file and replace with native `btoa`
- Redeploy the function

### Expected result
`extract-manifest` boots successfully → barlist XLS files can be processed again.

