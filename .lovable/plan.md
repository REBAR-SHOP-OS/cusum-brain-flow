

# Fix: AI Estimate Truncated JSON Parse Failure

## Problem
The `ai-estimate` function fails when the AI returns a truncated JSON response (~13,719 chars). The current repair logic finds the last `}` and closes the array, but this fails when truncation happens mid-value (e.g., inside a string or number), producing invalid JSON. Result: 0 items extracted → "Zero-weight guard" error.

The **same file succeeds on retry** (24,838 chars, 48 items) because the AI gives a complete response the second time.

## Root Cause
The truncation repair at line 538-544 is too naive — it assumes the last `}` is a valid object boundary, but truncation can occur mid-field, leaving broken syntax before the last brace.

## Solution

### File: `supabase/functions/ai-estimate/index.ts`

#### Change 1: Progressive truncation repair (lines 537-544)
Replace the simple "find last `}`" approach with a progressive strategy that tries successively shorter substrings until `JSON.parse` succeeds:

```ts
// Repair truncated JSON arrays — progressive approach
if (cleaned.startsWith("[") && !cleaned.trimEnd().endsWith("]")) {
  let repaired = false;
  let searchFrom = cleaned.length;
  for (let attempt = 0; attempt < 10 && !repaired; attempt++) {
    const braceIdx = cleaned.lastIndexOf("}", searchFrom);
    if (braceIdx <= 0) break;
    const candidate = cleaned.substring(0, braceIdx + 1) + "]";
    try {
      JSON.parse(candidate);
      cleaned = candidate;
      repaired = true;
      console.log(`Repaired truncated JSON (attempt ${attempt + 1}, salvaged ${candidate.length} chars)`);
    } catch {
      searchFrom = braceIdx - 1;
    }
  }
  if (!repaired) {
    console.warn("Could not repair truncated JSON after 10 attempts");
  }
}
```

This iteratively walks backward through `}` positions until it finds one that produces valid JSON, guaranteeing only complete objects are kept.

#### Change 2: Add auto-retry on zero extraction (after line 579)
If the AI returned content but parsing failed (0 items), retry the AI call once with a shorter prompt hint requesting smaller output:

```ts
// After the usefulness check block (~line 579), before closing the AI try block
if (extractedItems.length === 0 && !retried) {
  console.log("Zero items after first attempt — retrying AI with compact prompt");
  retried = true;
  // [retry logic using same structure but adding "Return compact JSON, no bbox field" to prompt]
}
```

This is a safety net — the progressive repair should handle most cases.

## Files changed
- `supabase/functions/ai-estimate/index.ts` — progressive JSON repair + optional retry on zero extraction

