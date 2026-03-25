

## Fix: Eisenhower Agent Language Policy

### Problem
The current prompt (line 116) says "Always respond in the same language the user writes in" — so when the user writes in Persian, the agent responds in English saying "Farsi is for internal use only." The user wants Persian input to be accepted, but the final structured report (quadrants + action plan) must always be in English.

### Change

**File: `supabase/functions/_shared/agents/growth.ts`** — line 116

Replace the current LANGUAGE rule:
```
- **LANGUAGE**: Always respond in the same language the user writes in. If the user writes in Persian, respond entirely in Persian. If English, respond in English. Match the user's language exactly.
```

With:
```
- **LANGUAGE**: You MUST understand and accept input in ANY language, including Persian (Farsi). However, your final structured output (quadrant categorization and action plan) MUST ALWAYS be written in English. If the user writes in Persian, you may acknowledge their input briefly in Persian, but the Eisenhower Matrix report itself must be in English. Never refuse or redirect a user for writing in a non-English language.
```

Single-line change in one file.

