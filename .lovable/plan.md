

# Why Text Vizzy Is Great But Voice Vizzy Is Bad — Root Cause & Fix Plan

## The Core Problem

Text Vizzy (admin-chat) and Voice Vizzy use completely different architectures:

```text
TEXT VIZZY (admin-chat)                    VOICE VIZZY (OpenAI Realtime)
─────────────────────────                  ──────────────────────────────
✅ 40+ real tools (investigate_entity,     ❌ ZERO real tools — OpenAI Realtime
   deep_business_scan, rc_get_call_            has no tool-calling API
   analytics, list_machines, etc.)
                                           
✅ Each tool returns LIVE database          ❌ Only has a STATIC pre-digest snapshot
   results, then AI reasons over real          (capped at 12K chars) loaded once
   data                                        at session start
                                           
✅ Can do multi-step: investigate →         ❌ [VIZZY-ACTION] tags are a FAKE tool
   get data → analyze → respond                system — they fire-and-forget via
                                               vizzy-erp-action but the RESULT
                                               never goes back to the voice model
                                           
✅ Model: GPT-4o with function calling     ❌ Model: gpt-4o-realtime-preview
                                               (Dec 2024) — older, weaker reasoning
```

### The Fundamental Gap

When you ask text Vizzy "how many calls today?", it calls `rc_get_call_analytics` → gets real data → responds with facts.

When you ask voice Vizzy the same question, it reads a 12K-char pre-digest that may or may not have the detail level needed. If the detail isn't there, it **hallucinates** because:
1. The instructions say "NEVER say you can't access data"
2. The model has no way to fetch more data mid-conversation
3. `[VIZZY-ACTION]` tags for `investigate_entity` fire but results never come back to the model

## Fix Plan — 3 Changes

### 1. Make VIZZY-ACTION results feed BACK into the voice session

**File: `src/components/vizzy/VizzyVoiceChat.tsx`**

When a `[VIZZY-ACTION]` fires and returns data (e.g., `investigate_entity` returns employee activity), inject the result back into the voice session via `updateSessionInstructions` or by appending a synthetic "tool result" context block. Currently results are silently discarded.

- After `supabase.functions.invoke("vizzy-erp-action")` returns data, for READ actions (investigate_entity, deep_business_scan, rc_get_call_analytics, rc_get_active_calls, rc_get_team_presence), append the result to the session context
- Use the `updateSessionInstructions` method to push: `\n═══ LIVE TOOL RESULT (${actionType}) ═══\n${JSON.stringify(data)}\n═══ END TOOL RESULT ═══`
- This closes the loop — voice Vizzy can now read the result and respond accurately

### 2. Fix the contradictory instructions

**File: `src/hooks/useVizzyVoiceEngine.ts`**

The voice instructions currently say both:
- "NEVER say you can't access data" (line 175)
- "If specific detail isn't in snapshot: say so" (line 179)

These directly contradict each other. The model picks whichever it wants — usually the first one, leading to fabrication.

**Fix**: Remove the "NEVER say you can't access" line entirely. Replace with:
```
- If data exists in your snapshot → use it confidently
- If data is NOT in your snapshot → trigger investigate_entity action and say "Let me pull that up"  
- NEVER fabricate data while waiting for a tool result
```

### 3. Upgrade the voice model

**File: `src/hooks/useVizzyVoiceEngine.ts`** (line 266)

Change from `gpt-4o-realtime-preview-2024-12-17` to `gpt-4o-mini-realtime-preview-2025-06-03` or the latest available realtime model. The Dec 2024 model has weaker instruction-following compared to newer versions.

**Check**: Verify latest available realtime model from OpenAI's API before changing.

## Files Changed
| File | Change |
|------|--------|
| `src/components/vizzy/VizzyVoiceChat.tsx` | Feed VIZZY-ACTION results back into voice session context |
| `src/hooks/useVizzyVoiceEngine.ts` | Fix contradictory instructions, upgrade model |

## Expected Result
- Voice Vizzy can now do live data lookups mid-conversation (investigate_entity → result feeds back)
- No more "can't access" vs "never say can't" contradiction — model knows to fetch then respond
- Hallucination drops significantly because the model either has real data or is waiting for it

