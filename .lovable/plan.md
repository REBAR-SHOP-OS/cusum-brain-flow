

## Audit: Why Vizzy Fabricates Employee Count

### Root Cause Chain

The snapshot data is correct — `vizzyFullContext.ts` line 276 computes `totalStaff = (profiles || []).length` which returns ~13 profiles, and line 534 outputs `👷 TEAM (13 staff)`. The customer count is also correct at ~50.

**Vizzy saying "85 employees" is pure hallucination.** There are two contributing factors:

**Factor 1: Stale Closure Bug (Critical — partially fixed)**
The previous fix added `instructionsRef` but `useVoiceEngine` still receives `instructions` as a config prop on line 81. If the engine internally uses the initial config value (not the ref), the voice session starts with ZERO ERP data. Without data, OpenAI's GPT-4o-mini-realtime invents numbers.

**Factor 2: Double-AI Compression Pipeline**
The data flows through TWO AI models before reaching the voice session:
1. `vizzyFullContext.ts` builds raw snapshot → sent to `vizzy-daily-brief`
2. `vizzy-daily-brief` sends it to **Gemini** to generate a "briefing" narrative
3. The Gemini briefing (narrative text, not structured data) becomes the voice session instructions
4. **OpenAI GPT-4o-mini-realtime** interprets this narrative

By step 3, the precise "TEAM (13 staff)" line has been rewritten by Gemini into prose. OpenAI then has to extract numbers from Gemini's prose — and if Gemini summarized or omitted specifics, OpenAI fills gaps with hallucinated numbers.

### Fixes

**1. Verify `useVoiceEngine` actually uses the ref**
Check how `useVoiceEngine.ts` consumes the `instructions` config — if it captures it once at initialization and never re-reads, the ref trick in `useVizzyVoiceEngine` is ineffective. The instructions must be passed to `voice-engine-token` at the moment of connection, using `instructionsRef.current`.

**2. Add explicit team roster to the prompt**
Add a hard constraint in `VIZZY_INSTRUCTIONS` (line 14-57 of `useVizzyVoiceEngine.ts`):
```
- When asked about employee count, ONLY use the number from the "TEAM (X staff)" line in the data below. NEVER estimate or infer.
```

**3. Preserve structured data through the Gemini compression**
In `vizzy-daily-brief/index.ts`, update the Gemini system prompt to explicitly say:
```
- Keep the TEAM (X staff) line with the exact number — do NOT change it
- Keep ALL specific counts (staff count, lead count, customer count) as-is
```

**4. Add a structured data header that bypasses compression**
Prepend a machine-readable summary block to the briefing that Gemini cannot rewrite:
```
[FACTS] staff=13, customers=50, open_leads=X, AR=$Y, AP=$Z [/FACTS]
```
This gives OpenAI a reliable anchor even if Gemini's prose is lossy.

### Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useVoiceEngine.ts` | Verify instructions are read at connection time, not cached at init |
| `src/hooks/useVizzyVoiceEngine.ts` | Add anti-hallucination rule to VIZZY_INSTRUCTIONS |
| `supabase/functions/vizzy-daily-brief/index.ts` | Update Gemini prompt to preserve exact numbers; add structured facts header |
| `supabase/functions/_shared/vizzyFullContext.ts` | Prepend a `[FACTS]` block with key metrics at the top of the snapshot |

