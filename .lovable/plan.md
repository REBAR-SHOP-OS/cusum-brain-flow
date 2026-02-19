

# Fix: Architect Agent Deflection / "I Cannot" Problem

## Root Cause

The FALLBACK PROTOCOL (lines 2458-2464) lists "React code issues, CSS problems, frontend logic errors" as things the agent cannot fix. This triggers BEFORE the agent considers using its `generate_patch` tool (line 2516) or Code Engineer Mode. Result: the agent gives up on UI changes it COULD handle via patch generation or exact code instructions.

The screenshot proves it: the agent says "I cannot directly modify ERP UI elements" instead of using `generate_patch` to produce a reviewable diff for the string change.

---

## Changes

### 1. Rewrite FALLBACK PROTOCOL to Eliminate Premature Deflection
**File:** `supabase/functions/ai-agent/index.ts` (lines 2458-2464)

Replace the current fallback with a mandatory tool-exhaustion rule:

```
### FALLBACK PROTOCOL (when direct database/API write tools do not apply):
If the problem is a UI string, label, layout, or frontend logic issue:
- **Step 1:** Use `generate_patch` to produce a reviewable code diff with the exact fix
- **Step 2:** If you can identify the file and line, provide the EXACT code change
- **Step 3:** NEVER say "I cannot modify UI elements" — you CAN generate patches

If you truly cannot determine the file or produce a patch:
- Ask ONE specific clarifying question (URL path, module name, or screenshot)
- Do NOT list generic developer steps
- Do NOT say "a developer would need to..."

You are FORBIDDEN from saying:
- "I cannot directly modify..."
- "This would require a developer..."
- "I don't have the ability to..."
Instead: investigate with tools, produce a patch, or ask a precise question.
```

### 2. Add Anti-Deflection Rule to EXECUTION DISCIPLINE Block
**File:** `supabase/functions/ai-agent/index.ts` (line 2299, after existing absolute rules)

Add one new absolute rule:

```
- You are FORBIDDEN from saying "I cannot", "I don't have the ability", or "This requires a developer". You have generate_patch, db_write_fix, and Code Engineer Mode. Use them or ask ONE specific question.
```

### 3. Elevate Code Engineer Mode Priority
**File:** `supabase/functions/ai-agent/index.ts` (lines 2516-2527)

Move the Code Engineer Mode instructions to appear BEFORE the fallback protocol (right after the autofix section at line 2469), so the agent considers patch generation before falling back. Add a trigger rule:

```
## Code Engineer Mode (AUTO-ACTIVATES for UI/code changes):
When the user asks to rename, change text, fix layout, modify styling, update labels, or any frontend change:
1. Use `generate_patch` to produce a reviewable unified diff
2. Use `validate_code` to check the patch
3. Present the patch for review
This mode activates AUTOMATICALLY for any request involving UI text, labels, or component changes. You do NOT need the user to say "generate patch".
```

---

## Files Modified

| File | Change |
|------|--------|
| `supabase/functions/ai-agent/index.ts` | Rewrite fallback protocol, add anti-deflection rule, elevate Code Engineer Mode |

## What This Fixes

- Agent will no longer say "I cannot modify ERP UI elements"
- String/label rename requests will trigger `generate_patch` automatically
- The "I cannot" / "a developer would need to" deflection pattern is explicitly forbidden
- Code Engineer Mode activates for UI changes without requiring magic keywords
