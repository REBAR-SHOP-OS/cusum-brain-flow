

# Fix: `dedupedRows is not defined` in extract-manifest

## Root Cause
In `supabase/functions/extract-manifest/index.ts`, `dedupedRows` is declared with `const` inside a block scope (lines 565-597, inside an `if` or block ending at line 598). Line 610 references `dedupedRows.length` **outside** that block, causing a `ReferenceError`.

## Fix — `supabase/functions/extract-manifest/index.ts`

**Line 610**: Replace the `console.log` that references `dedupedRows` with a version that doesn't depend on the block-scoped variable:

```typescript
// Before (line 610):
console.log(`Extraction complete for session ${sessionId}: ${dedupedRows.length} rows saved (from ${items.length} raw)`);

// After:
console.log(`Extraction complete for session ${sessionId}`);
```

Alternatively, declare a `savedCount` variable **before** the block, set it inside, and use it on line 610. This preserves the logging detail:

```typescript
// Before the block (around line 564):
let savedCount = 0;

// Inside the block (after line 586):
savedCount = dedupedRows.length;

// Line 610:
console.log(`Extraction complete for session ${sessionId}: ${savedCount} rows saved`);
```

**Preferred approach**: The second option (track `savedCount`) — preserves useful debug info.

## Impact
- 1 edge function changed: `extract-manifest/index.ts`
- Fixes the crash that prevents extraction from completing
- No database or frontend changes needed

