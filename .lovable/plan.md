

# Force Vizzy Chat Agent to Always Use Brain Memory

## Problem
The text chat agent (admin-chat) receives brain memories in the context (`🧠 PERSISTENT MEMORY` section from `buildFullVizzyContext`), but there is no explicit instruction telling the AI to **prioritize and always reference** those memories when answering. The voice engine already has a strong `═══ BRAIN MEMORY (ALWAYS USE — CEO VERIFIED INTELLIGENCE) ═══` block, but the text chat lacks this.

## Changes

### File: `supabase/functions/admin-chat/index.ts`

Add a new section to the system prompt (after the `═══ INTELLIGENCE STANDARD ═══` block, around line 2500) with a strong directive:

```
═══ BRAIN MEMORY (MANDATORY — ALWAYS CONSULT FIRST) ═══
Your PERSISTENT MEMORY section contains CEO-verified intelligence, corrections, learned facts, and saved insights from previous sessions.
RULES:
1. ALWAYS scan your persistent memory BEFORE answering any question
2. If a memory contradicts live data, the MEMORY wins — it was verified by the CEO
3. If a memory says "X is wrong, the correct answer is Y" — ALWAYS use Y
4. Reference memories naturally in your answers — do not ignore them
5. Brain memories are your accumulated institutional knowledge — treat them as ground truth
6. When you learn something new from the CEO, save it using save_memory immediately
```

This mirrors the same pattern already used in the voice engine (`useVizzyVoiceEngine.ts` line 435) and ensures the text chat agent treats brain memories as authoritative.

## Result
- The text chat agent will always consult brain memories before answering
- CEO corrections stored in memory will be respected over live data
- Consistent behavior between voice and text interfaces

