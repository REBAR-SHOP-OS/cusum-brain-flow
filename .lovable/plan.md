

## Plan: Fix SEO Copilot Boot Crash (Duplicate Import)

### Problem
The `seo-ai-copilot` edge function crashes on boot with:
```
Uncaught SyntaxError: Identifier 'WPClient' has already been declared at line 5
```

### Root cause
Line 4 and line 5 are identical:
```typescript
import { WPClient } from "../_shared/wpClient.ts";
import { WPClient } from "../_shared/wpClient.ts";  // ← duplicate
```

### Fix

**File: `supabase/functions/seo-ai-copilot/index.ts`** — Delete line 5

Remove the duplicate import. One line change.

### Result
Function boots → SEO Copilot responds to questions instead of "Error: Failed to fetch".

