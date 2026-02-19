

# Fix: Architect Agent Still Deflecting on Code Change Requests

## Problem

The screenshot shows the Architect saying "I cannot add a new AI user interface to the pipeline, as that requires a code change." This violates the anti-deflection rules we already added, because:

1. **Loophole at lines 2283-2284**: The phrase "Only create vizzy_fix_requests for issues requiring frontend code changes that are outside your tool capabilities" gives the agent an escape hatch. It interprets feature requests as "outside tool capabilities" and deflects instead of using `generate_patch`.

2. **Missing feature-request handling**: The anti-deflection rules cover "I cannot modify" but don't explicitly cover "this requires a code change" -- which is the exact phrase the agent used in the screenshot.

## Changes

### 1. Close the Loophole (lines 2283-2284)
**File:** `supabase/functions/ai-agent/index.ts`

Replace:
```
Only create vizzy_fix_requests for issues requiring frontend code changes
that are outside your tool capabilities.
```

With:
```
For ANY code or UI change request: use generate_patch to produce a reviewable diff FIRST.
Only create vizzy_fix_requests if generate_patch cannot produce a valid patch AND you have exhausted all tool options.
```

### 2. Add "requires a code change" to the Forbidden Phrases (line 2470-2473)
**File:** `supabase/functions/ai-agent/index.ts`

Add to the existing forbidden phrases list:
```
- "This requires a code change"
- "as that requires a code change"
```

### 3. Add Feature Request Routing Rule (after line 2300)
**File:** `supabase/functions/ai-agent/index.ts`

Add a new rule after the existing anti-deflection rule:
```
- When the user requests a NEW FEATURE (e.g., "add AI to pipeline", "add a dashboard widget", "create a new page"): use generate_patch to produce a code diff implementing it. You are a Code Engineer — feature requests ARE your job. Never classify them as "outside your capabilities."
```

## Technical Details

| File | Lines | Change |
|------|-------|--------|
| `supabase/functions/ai-agent/index.ts` | 2283-2284 | Close loophole: require generate_patch before fix_requests |
| `supabase/functions/ai-agent/index.ts` | 2300 | Add feature request routing rule |
| `supabase/functions/ai-agent/index.ts` | 2470-2473 | Add "requires a code change" to forbidden phrases |

## What This Fixes

- The agent will no longer say "this requires a code change" and stop
- Feature requests like "add AI to pipeline" will trigger Code Engineer Mode and produce a patch
- The loophole that allowed the agent to classify requests as "outside tool capabilities" is closed
- The agent must attempt `generate_patch` before creating any fix request

