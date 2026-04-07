

# Fix: Vizzy Voice Hallucinating Call Data

## Root Cause

The pre-digest pipeline correctly computes call counts and flags absent employees. The hallucination happens at the **OpenAI Realtime model layer** — the voice model ignores grounding constraints and fabricates plausible call breakdowns. Three factors enable this:

1. **Encouraging instruction**: Line 225 says "Speak from it like you already know — don't say 'let me check'" — this tells the model to sound confident even when data is sparse
2. **No hard refusal rule for specifics**: The model is told to never say "I can't access" but has no rule saying "if per-call detail is missing, say so"
3. **Weak data boundary enforcement**: The `DATA BOUNDARY` fence is present but the model treats it as a suggestion, not a hard stop

## Fix: Strengthen Anti-Hallucination in Voice Instructions

**File: `src/hooks/useVizzyVoiceEngine.ts`**

### Change 1: Replace the "speak confidently" instruction (line 225)

Replace:
```
You have ALREADY gone through all the raw data, analyzed every employee, read every call note, checked every email, compared benchmarks. The analysis below is YOUR OWN work. Speak from it like you already know — don't say "let me check" or "looking at the data." You KNOW.
```

With:
```
The analysis below is your pre-session study. Use it as your ONLY source of truth.
CRITICAL: If specific details (who called whom, what was discussed, call content) are NOT written below, you MUST say "That level of detail isn't in today's snapshot." NEVER fill in plausible-sounding details. Inventing call content or attributing calls to people not listed is a CRITICAL FAILURE.
```

### Change 2: Strengthen the ANTI-HALLUCINATION block (lines 154-157)

Add after line 157:
```
- Call details: ONLY report calls for employees who appear in the CALLS section below with specific numbers. If an employee has 0 calls or is not listed, say "no calls recorded today."
- Call content: NEVER describe what was discussed on a call unless an actual call note or transcript appears in the data below. "Discussing pricing" or "follow-up with client" without a source is FABRICATION.
- If someone is listed as ABSENT or has no activity: NEVER attribute any calls, emails, or work to them. Say "[Name] has no recorded activity today."
- When asked to "break down by individual": ONLY list people who have ACTUAL numbered entries in the data. Do NOT invent entries for unlisted employees.
```

### Change 3: Strengthen DATA BOUNDARY (line 229-231)

Replace:
```
═══ DATA BOUNDARY ═══
EVERYTHING ABOVE is your data source. If a fact is NOT above, say "I don't have that in today's data."
NEVER invent numbers, names, or events not found above.
```

With:
```
═══ DATA BOUNDARY (ABSOLUTE — VIOLATION = SYSTEM FAILURE) ═══
EVERYTHING ABOVE is your ONLY data source. There is NO other data.
Rules that CANNOT be overridden:
1. If a number is not written above → say "I don't have that figure"
2. If a call detail (who talked to whom, what was discussed) is not written above → say "I don't have call content details in today's data"
3. If an employee name does not appear in the calls section above → they had ZERO calls. Do NOT guess otherwise.
4. NEVER generate plausible-sounding call summaries. The CEO WILL catch fabricated data and it destroys trust.
5. Fabricating data is worse than saying "I don't know." ALWAYS choose honesty.
```

## Also update pre-digest prompt

**File: `supabase/functions/vizzy-pre-digest/index.ts`**

In the pre-digest system prompt (line 146), after the PER-PERSON INTELLIGENCE section, add:

```
FOR EACH PERSON WITH CALLS:
- List EXACT call count, duration, direction
- If call notes/transcripts exist in the raw data, summarize them
- If NO call notes exist, write: "No call notes available — only metadata (count/duration)"
- NEVER invent call content or topics discussed
```

This ensures the digest itself doesn't fabricate, and even if it does, the voice model has a second layer of defense.

## Files Changed
| File | Change |
|------|--------|
| `src/hooks/useVizzyVoiceEngine.ts` | Strengthen 3 instruction blocks to hard-block call data fabrication |
| `supabase/functions/vizzy-pre-digest/index.ts` | Add explicit call-note availability rule to digest prompt |

