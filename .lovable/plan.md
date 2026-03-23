

## Fix: Vizzy Must Always Verify Before Speaking About Employees

### Problem

When asked about Ben's activity, Vizzy first said "no activity" (relying on the context snapshot), then reversed after being pushed. The CEO's rule: **refresh all data before answering — no more mistakes like this.**

The root cause: Text Vizzy has `investigate_entity` but doesn't always call it before answering employee questions. It sometimes answers from the pre-built context snapshot (which may not include granular per-employee data), then only investigates when challenged.

### Fix: 2 Changes

#### 1. Mandatory Employee Investigation Rule (Text Vizzy)

**File**: `supabase/functions/admin-chat/index.ts` (~line 2508, DEEP INVESTIGATION PROTOCOL section)

Add a hard rule:

```text
═══ MANDATORY DATA REFRESH RULE (CRITICAL — CEO DIRECT ORDER) ═══
When the CEO asks about a SPECIFIC employee (their activity, calls, emails, performance, status):
1. ALWAYS call investigate_entity with their name FIRST — before saying a single word about them
2. NEVER answer from the context snapshot alone — it may be incomplete
3. If investigate_entity returns empty, THEN say "no activity found" — not before
4. If the CEO corrects you ("they WERE working"), immediately save_memory with the correction
This rule is NON-NEGOTIABLE. Breaking it causes the CEO to lose trust.
```

#### 2. Same Rule for Voice Vizzy + Auto-Learn from Corrections

**File**: `src/hooks/useVizzyVoiceEngine.ts` (add near the INTELLIGENCE STANDARD section)

Add:

```text
═══ MANDATORY DATA REFRESH RULE (CRITICAL — CEO DIRECT ORDER) ═══
When asked about a SPECIFIC employee's activity, calls, emails, or performance:
1. ALWAYS trigger investigate_entity FIRST via [VIZZY-ACTION] before answering
2. While waiting for results, say "Let me pull up [name]'s full activity..." — do NOT guess
3. NEVER answer employee questions from pre-digest alone — always verify with a fresh lookup
4. If the CEO corrects you, IMMEDIATELY save the correction:
   [VIZZY-ACTION]{"type":"save_memory","category":"business","content":"CEO correction: [what they said]"}[/VIZZY-ACTION]

═══ LEARNING FROM CORRECTIONS ═══
When the CEO says "that's wrong", "no they were working", or corrects any claim you made:
- Acknowledge the error immediately: "You're right, my mistake."
- Save the correction to memory so you never repeat it
- NEVER argue with or question the CEO's correction
```

### Files Changed

| File | Change |
|---|---|
| `supabase/functions/admin-chat/index.ts` | Add MANDATORY DATA REFRESH rule to system prompt |
| `src/hooks/useVizzyVoiceEngine.ts` | Add same rule + auto-learn from corrections |

### What This Fixes
- Vizzy will always call `investigate_entity` before answering about any employee
- No more "no activity" answers based on incomplete snapshots
- CEO corrections are saved as memory to prevent repeat mistakes

