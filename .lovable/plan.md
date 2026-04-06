

# Enforce Data-Grounded Answers in Vizzy Voice Engine

## Problem
When the CEO asks aggregate questions like "how many people are active?" or "who's online?", Vizzy sometimes gives inaccurate answers instead of reading directly from the injected ERP data (team presence, time clock entries, profiles).

## Root Cause
The current instructions enforce data usage for individual employee lookups (via `investigate_entity`), but lack a strong directive for **aggregate team queries**. Vizzy may paraphrase or estimate instead of reading the exact numbers from the `[FACTS]` block and `TEAM PRESENCE` section.

## Changes

### 1. `src/hooks/useVizzyVoiceEngine.ts` — Add Team Query Data Rule

Add a new section to `VIZZY_INSTRUCTIONS` (after the `ANTI-HALLUCINATION: HARD NUMBER RULES` block, around line 411):

```
═══ TEAM & PRESENCE QUERIES (MANDATORY DATA-ONLY) ═══
When asked "how many people are active", "who's working", "who's online", "how many staff":
1. Go to TEAM PRESENCE section — count who is "Currently Clocked In" = ACTIVE
2. Count who is "Clocked Out Today" = was here but left
3. Cross-reference with the full profiles list to identify who is ABSENT (no clock entry at all)
4. Report EXACT numbers: "Right now X people are clocked in: [names]. Y already left today. Z haven't shown up."
5. NEVER estimate or round. NEVER say "about" or "around" for headcount.
6. For "total staff" → use the [FACTS] block number ONLY
7. For "who's online right now" → ONLY count Currently Clocked In from TEAM PRESENCE
```

Also strengthen the `QUESTION → DATA MAPPING` section (line 367) to add:
```
- "How many people are active?" / "Who's online?" / "چند نفر فعال هستن؟" → TEAM PRESENCE (Currently Clocked In) + cross-ref full staff list
```

### 2. `supabase/functions/_shared/vizzyFullContext.ts` — Add Staff Summary Line

In the output string, add a clear factual summary line near the `[FACTS]` block that states:
```
STAFF PRESENCE: X currently clocked in, Y clocked out today, Z total registered staff
```

This gives Vizzy an unambiguous single line to read for presence queries.

### Result
- Vizzy will always report exact, real-time numbers for team presence
- No hallucination or estimation for "how many people are active"
- Both Farsi and English queries about staff presence map to the correct data section

