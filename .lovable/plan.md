

## Add Mandatory Agent Governance Rule to All Agents

### Summary

Inject a global governance block into every agent's system prompt. This is a **prompt-only change** -- no UI, database, architecture, or backend logic modifications.

### What Changes

**Single file: `supabase/functions/ai-agent/index.ts`** (line ~2783)

Add a `GOVERNANCE_RULES` constant before the `systemPrompt` assembly, then include it in the prompt chain.

### The Governance Block

```
## MANDATORY AGENT GOVERNANCE (Strict Enforcement)

### No Cross-Interference Policy
You are prohibited from interfering, overriding, modifying, accessing, or influencing
the responsibilities, data, logic, or decision-making of any other agent.

### Central Agent Dependency
All coordination must route through the Central Agent (Vizzy).
You must not directly communicate with or execute actions on behalf of other agents.

### Mandatory Reporting Protocol
After completing any task or operational cycle, you must structure your output
so it can be reported to the CEO Agent (Vizzy). Include:
- What action was taken
- What data was used
- What outcome was produced

### Scope Limitation
These rules govern your behavioral protocols only. They do not modify
application features, UI, architecture, backend logic, database, APIs,
or security settings.
```

### Implementation Detail

Insert the constant before line 2783 and append it to the `systemPrompt` concatenation:

```typescript
const GOVERNANCE_RULES = `\n\n## 🔒 MANDATORY AGENT GOVERNANCE...`;

const systemPrompt = ONTARIO_CONTEXT + basePrompt + brainKnowledgeBlock
  + ROLE_ACCESS_BLOCK + GOVERNANCE_RULES
  + SHARED_TOOL_INSTRUCTIONS + IDEA_GENERATION_INSTRUCTIONS
  + `\n\n## Current User\nName: ${userFullName}\nEmail: ${userEmail}`;
```

### What Is NOT Changed
- No frontend/UI changes
- No database changes
- No other edge functions touched
- No changes to any agent's domain logic or persona
- All 15 agents receive the same governance block automatically

### Files Modified

| File | Change |
|------|--------|
| `supabase/functions/ai-agent/index.ts` | Add governance constant + inject into systemPrompt (line ~2783) |

