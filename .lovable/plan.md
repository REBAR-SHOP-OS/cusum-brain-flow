

## Why Voice Vizzy Says "Vicky Has Activity" When She's Absent

### Root Cause

Voice Vizzy uses OpenAI's Realtime API (`gpt-4o-mini-realtime-preview`) which does **NOT support tool calling**. Unlike text Vizzy (which can call `deep_business_scan`, `investigate_entity`, etc. in real-time), voice Vizzy gets a **single static context snapshot** at session start via `vizzy-pre-digest`.

The pre-digest includes 7 days of call notes and benchmark history. So even if Vicky is absent TODAY, the digest contains her previous days' activity. The AI then incorrectly references that older data when asked about "today."

### The Fix: Strengthen Today-Only Awareness in Pre-Digest

**File**: `supabase/functions/vizzy-pre-digest/index.ts`

Add an explicit instruction to the AI digestion prompt:

1. **Add an ABSENT EMPLOYEES section** — The digest prompt should explicitly list employees with ZERO activity today (no clock-in, no calls, no emails, no page views) and mark them clearly as **"ABSENT TODAY — DO NOT report any activity for this person today"**

2. **Separate TODAY vs HISTORICAL data** — Add a clear header in the digest: `═══ TODAY ONLY (do NOT mix with previous days) ═══` for today's data, and `═══ HISTORICAL CONTEXT (previous days, for reference only) ═══` for call notes from earlier days

3. **Add a hard rule to the VIZZY_INSTRUCTIONS** in `useVizzyVoiceEngine.ts`:
   ```text
   ═══ ABSENCE DETECTION (CRITICAL) ═══
   The pre-digest marks employees as ABSENT TODAY when they have zero activity.
   If someone is marked ABSENT:
   - Say "[Name] is off today — no clock-in, no calls, no emails."
   - NEVER reference their previous days' activity as if it happened today.
   - If asked "what did [absent person] do today?" → "Nothing — they're not in today."
   ```

### Changes

| File | Change |
|---|---|
| `supabase/functions/vizzy-pre-digest/index.ts` | Add "ABSENT EMPLOYEES" section to digest prompt + separate today vs historical data |
| `src/hooks/useVizzyVoiceEngine.ts` | Add ABSENCE DETECTION rule to VIZZY_INSTRUCTIONS (~5 lines) |

### What This Fixes
- Voice Vizzy will correctly say "Vicky is off today" instead of fabricating activity
- Historical call notes from previous days won't be confused with today's data
- Clear separation prevents the LLM from mixing time periods

