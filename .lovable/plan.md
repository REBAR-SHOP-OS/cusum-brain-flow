

## Fix: `[object Object]` Displayed Instead of Error Messages

### Problem
Multiple places in the codebase use `String(err)` to convert caught errors into display strings. When the thrown error is a plain JavaScript object (not an `Error` instance), `String(err)` produces the literal text `[object Object]`, which is then shown to users in toasts and on-screen error messages.

### Root Cause
The Supabase SDK and edge function responses can throw or return plain objects (e.g., `{ message: "...", code: "..." }`). The pattern `String(err)` only works correctly for `Error` instances (which have a `.toString()` returning the message). For plain objects, it falls back to `[object Object]`.

This pattern appears in **11 files** across the codebase, but the most impactful instance is in `src/hooks/useQuickBooksData.ts` (line 496), where it sets the `error` state that gets rendered on the Accounting page and shown in toast notifications.

### Solution
Create a shared utility function `getErrorMessage(err)` that safely extracts a human-readable message from any thrown value, and replace all `String(err)` calls with it.

### Changes

**File: `src/lib/utils.ts`** -- Add a utility function:
```typescript
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const obj = err as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    if (typeof obj.error === "string") return obj.error;
    if (typeof obj.msg === "string") return obj.msg;
    try { return JSON.stringify(err); } catch { /* fall through */ }
  }
  return "An unexpected error occurred";
}
```

**Files to update** (replace `String(err)` with `getErrorMessage(err)`):

1. `src/hooks/useQuickBooksData.ts` -- 7 occurrences (lines 496, 512, 565, 579, 593, 629, plus toast descriptions)
2. `src/hooks/usePennyQueue.ts` -- 4 occurrences (lines 97, 114, 128, 141, 153)
3. `src/hooks/useAutomationConfigs.ts` -- 2 occurrences
4. `src/components/accounting/AccountingAccounts.tsx` -- 1 occurrence
5. `src/components/accounting/AccountingVendors.tsx` -- 1 occurrence
6. `src/components/accounting/VendorDetail.tsx` -- 3 occurrences
7. `src/components/accounting/AddVendorDialog.tsx` -- 1 occurrence
8. `src/components/accounting/NewAccountDrawer.tsx` -- 1 occurrence
9. `src/components/accounting/AccountingAudit.tsx` -- 1 occurrence
10. `src/pages/ConnectionsAudit.tsx` -- 1 occurrence

Each file will add `import { getErrorMessage } from "@/lib/utils"` and replace `String(err)` with `getErrorMessage(err)`.

### Impact
- Eliminates all `[object Object]` error displays across the Accounting workspace
- Provides meaningful error messages from any error shape (Error instances, plain objects with `.message`, `.error`, or `.msg` properties, strings, or fallback JSON)
- No behavioral changes -- only the error message extraction logic improves
