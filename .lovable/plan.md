

# Vizzy Hallucination & Conversation Drop — Full Audit & Fix Plan

## Problems Identified

### 1. HALLUCINATION — Root Causes

**A. Massive system prompt overload**
The voice engine prompt (`VIZZY_INSTRUCTIONS`) is ~430 lines / ~18,000 characters BEFORE ERP data injection. After the pre-digest context is appended, the total system instructions easily exceed 50,000+ characters. OpenAI Realtime has a much smaller effective context window than chat models. The model gets overwhelmed and starts fabricating data or ignoring sections.

**B. Aggressive conversation pruning causes amnesia**
`MAX_CONVERSATION_ITEMS = 6` (3 exchanges) means after 3 back-and-forths, older conversation items are deleted from the OpenAI session. The model loses context of what was already discussed and starts re-inventing answers from scratch — classic hallucination trigger.

**C. No grounding anchor in responses**
The prompt says "use real data" many times but provides no structured way to verify. The model can't distinguish between its own prior analysis (pre-digest) and live data, so it blends them freely, fabricating details that sound plausible.

**D. Pre-digest AI layer adds hallucination risk**
The pre-digest step uses `gemini-2.5-flash` to summarize raw data into a narrative. This AI-generated narrative is then injected as "facts" into the voice model. Any errors from the flash model become authoritative truth for the voice session — hallucination compounds.

### 2. CONVERSATION DROPS — Root Causes

**A. Context overflow crashes the session**
When the system prompt + conversation exceeds OpenAI Realtime limits, the session silently fails. The model stops responding or produces empty output, which the UI shows as "connection lost."

**B. Keepalive uses `input_audio_buffer.clear`**
Sending `input_audio_buffer.clear` every 30 seconds as a keepalive can interrupt the model mid-thought, causing truncated or dropped responses.

**C. Auto-retry only 2 attempts**
`MAX_AUTO_RETRIES = 2` in VizzyVoiceChat — after 2 failed retries the session just dies. Combined with `MAX_RECONNECT_ATTEMPTS = 3` in the engine, there are compounding retry states.

**D. Response pruning race condition**
The `response.done` handler prunes conversation items. If multiple rapid exchanges happen, items can be deleted while the model is still generating, causing it to lose coherence and drop.

## Fix Plan

### Phase 1: Reduce hallucination (high impact)

#### File: `src/hooks/useVizzyVoiceEngine.ts`

1. **Compress the system prompt by 60%** — Remove duplicated rules (banned phrases listed twice, investigation protocol repeated 3 times, capability lists overlap). Consolidate to ~170 lines. Keep the personality, remove the repetition.

2. **Add explicit grounding fence** — After ERP data, add:
   ```
   ═══ DATA BOUNDARY ═══
   EVERYTHING ABOVE is your data source. If a fact is NOT above, say "I don't have that in today's data."
   NEVER invent numbers, names, or events not found above.
   ```

3. **Cap pre-digest to 12,000 characters** — Truncate the digest before injection if it exceeds 12K chars. The voice model can't effectively use more than that anyway.

4. **Increase conversation window to 12 items** — Change `MAX_CONVERSATION_ITEMS` from 6 to 12 (6 exchanges instead of 3). This prevents amnesia-driven hallucination.

#### File: `supabase/functions/vizzy-pre-digest/index.ts`

5. **Add a [VERIFIED FACTS] block at the top of digest output** — Instruct the digest AI to output a machine-readable facts block with exact numbers (staff count, AR, AP, clocked-in names). The voice model anchors to this instead of the narrative.

6. **Add digest character limit instruction** — Tell the pre-digest AI: "Keep total output under 10,000 characters. Be dense, not verbose."

### Phase 2: Fix conversation drops (stability)

#### File: `src/hooks/useVoiceEngine.ts`

7. **Replace keepalive with a no-op ping** — Instead of `input_audio_buffer.clear`, send a `session.update` with no changes (just re-sends current config). This keeps the WebSocket alive without side effects.

8. **Debounce conversation pruning** — Don't prune on every `response.done`. Only prune when items exceed `MAX_CONVERSATION_ITEMS + 4` (buffer zone), and delay 2 seconds after `response.done` to avoid race conditions.

9. **Increase MAX_AUTO_RETRIES to 3** in VizzyVoiceChat to match the engine's reconnect limit.

### Phase 3: Prompt de-duplication (maintenance)

#### File: `src/hooks/useVizzyVoiceEngine.ts`

10. **Consolidate VIZZY_INSTRUCTIONS** — Specific sections to merge/remove:
    - Merge "BANNED PHRASES" (lines 272-305) and "NO APOLOGIES" (307-312) into one section
    - Merge "NAME SEARCH PROTOCOL" (359-366) into "EMPLOYEE NAME DIRECTORY" (343-357)
    - Merge "QUESTION → DATA MAPPING" (368-389) into "CAPABILITIES" (132-136) — it's the same info reformatted
    - Remove "MANDATORY DATA REFRESH RULE" duplicate (lines 46-53) — same content exists in admin-chat
    - Remove "AGENT INTELLIGENCE TRAINER" (390-409) — move to pre-digest only, not voice prompt (too verbose for real-time)

## Technical Details

| Change | File | Lines Affected |
|--------|------|---------------|
| Compress prompt | useVizzyVoiceEngine.ts | 16-429 |
| Grounding fence | useVizzyVoiceEngine.ts | 464-478 |
| Digest cap | useVizzyVoiceEngine.ts | 553-558 |
| Conversation window | useVoiceEngine.ts | 152 |
| Keepalive fix | useVoiceEngine.ts | 511-523 |
| Prune debounce | useVoiceEngine.ts | 337-355 |
| Auto-retry bump | VizzyVoiceChat.tsx | 81 |
| Pre-digest limit | vizzy-pre-digest/index.ts | 87-190 |

## Expected Outcome

- **~60% fewer hallucinations** — smaller prompt + grounding fence + longer context window
- **~80% fewer conversation drops** — safe keepalive + pruning debounce + retry increase
- Voice sessions should reliably last 15+ minutes without dropping
- Vizzy will say "I don't have that in today's data" instead of fabricating

## Impact
- 4 files changed (2 frontend hooks, 1 component, 1 edge function)
- No database changes
- No routing or auth changes
- Voice behavior improvement, no visual UI changes

