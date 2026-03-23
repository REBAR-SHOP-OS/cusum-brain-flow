

## Add `auto_diagnose_fix` Tool to Vizzy — Self-Healing via App Builder

### What This Does

Gives Vizzy the ability to diagnose and fix system bugs by calling the existing `generate-fix-prompt` edge function internally. When you tell Vizzy "social publish is broken" or "QuickBooks sync failing", she'll analyze the issue, generate a root cause + fix plan, and log it for tracking.

### Implementation (1 File)

**File**: `supabase/functions/admin-chat/index.ts`

#### Change 1: Tool Definition (after line 686, before closing `]`)

```typescript
{
  type: "function",
  function: {
    name: "auto_diagnose_fix",
    description: "Diagnose a system bug using AI analysis. Generates root cause analysis, suggested code fix, and affected files. Use when CEO reports a bug, error, or broken feature.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short bug title" },
        description: { type: "string", description: "What's happening — symptoms, error messages, context" },
        severity: { type: "string", enum: ["critical", "high", "medium", "low"], description: "How urgent" },
      },
      required: ["title", "description"],
      additionalProperties: false,
    },
  },
},
```

#### Change 2: Handler (before `default:` case)

Calls `generate-fix-prompt` internally via `callAI` (same LLM infra), then saves result to `vizzy_memory`:

1. Takes title + description + severity
2. Calls `callAI` with the same system prompt used in `generate-fix-prompt` (the debugging expert prompt)
3. Returns structured diagnosis: root cause, fix steps, affected files, testing plan
4. Saves to `vizzy_memory` with category `"auto_fix"` and key = timestamp for tracking

#### Change 3: Progress Label

Add `auto_diagnose_fix: "diagnosing issue"` to progressLabels map.

### Files Changed

| File | Change | Category |
|---|---|---|
| `supabase/functions/admin-chat/index.ts` | Add tool def + handler + progress label | Safe additive |

### What is NOT Changed
- `generate-fix-prompt` edge function unchanged (reuse its prompt pattern, not call it)
- No schema changes
- No new edge functions
- Existing tools unaffected

