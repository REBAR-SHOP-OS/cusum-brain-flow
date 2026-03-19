

# Vizzy System Audit

## Architecture Overview

```text
┌─────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                          │
│  VizzyVoiceChat.tsx → useVizzyVoiceEngine → useVoiceEngine│
│  (OpenAI Realtime WebRTC, shimmer voice, gpt-4o-mini)    │
│  AgentWorkspace.tsx (text chat via admin-chat function)   │
└──────────────┬──────────────────────────────┬────────────┘
               │                              │
┌──────────────▼──────────────┐  ┌────────────▼────────────┐
│   INTELLIGENCE PIPELINE      │  │   ACTION EXECUTION       │
│  vizzy-pre-digest (primary)  │  │  vizzy-erp-action        │
│  vizzy-daily-brief (fallback)│  │  (create_task, send_email,│
│  vizzy-briefing (compressor) │  │   merge_customers, etc.)  │
│  vizzy-context (snapshot API)│  │  vizzy-agent-audit        │
└──────────────┬──────────────┘  └────────────────────────────┘
               │
┌──────────────▼──────────────┐
│   SHARED DATA LAYER          │
│  vizzyFullContext.ts (998 ln) │
│  23 parallel DB queries       │
│  5 cached, 18 realtime        │
│  Phone/email → employee map   │
│  Digital footprint engine     │
│  Per-person daily reports     │
└──────────────────────────────┘
```

## Component Scores

| Component | Score | Status |
|-----------|-------|--------|
| Voice Engine (`useVoiceEngine.ts`) | 8/10 | Solid — clean WebRTC, timeout, mute, session cap |
| Vizzy Prompt (`useVizzyVoiceEngine.ts`) | 9/10 | Excellent — comprehensive, anti-hallucination, banned phrases |
| Pre-Digest Pipeline | 8/10 | Strong — benchmark history, agent audit integration |
| Full Context Builder | 7/10 | Functional but massive (998 lines, ~25 queries) |
| ERP Action Handler | 8/10 | Well-structured, proper auth, good coverage |
| Call Receptionist | 8/10 | Clean, focused, proper confidentiality rules |
| Agent Audit | 9/10 | Thorough — reads source + logs, generates patches |
| VizzyVoiceChat UI | 7/10 | Good UX, but action parsing in useEffect is fragile |

## Issues Found

### 1. Context Builder Performance Risk (Medium)
**vizzyFullContext.ts** runs 23 parallel queries (18 uncached) on every session start. At ~998 lines, it's the single largest shared module. Any single query timeout cascades to a failed session.

**Recommendation**: Add per-query timeouts and graceful degradation — if one query fails, omit that section rather than failing the entire context build.

### 2. Hardcoded Phone-to-Employee Map (Medium)
Lines 494-507 of `vizzyFullContext.ts` hardcode phone numbers for employee mapping. When employees change numbers or new hires arrive, this breaks silently.

**Recommendation**: Move phone mappings to a `employee_phones` table or a column on `profiles`. The auto-enrichment from call notes (lines 509-520) is smart but only catches numbers that appear in call note subjects.

### 3. VIZZY-ACTION Parsing in useEffect (Low-Medium)
`VizzyVoiceChat.tsx` lines 88-158 parse and execute `[VIZZY-ACTION]` blocks inside a `useEffect` triggered by transcript changes. This has no debounce, no retry on failure, and could double-fire if React re-renders.

**Current mitigation**: `processedActionsRef` prevents re-processing the same transcript ID. This works but is fragile.

### 4. Duplicate Context Endpoints (Low)
Three functions serve similar purposes:
- `vizzy-context` — returns raw snapshot object
- `vizzy-daily-brief` — returns AI-summarized briefing + raw context
- `vizzy-pre-digest` — returns AI-digested + benchmark-aware briefing + raw context

`vizzy-context` appears unused by the voice flow (only `pre-digest` and `daily-brief` are called from `useVizzyVoiceEngine`).

### 5. Token/Context Size (Medium)
The full prompt (`VIZZY_INSTRUCTIONS` at 300 lines) + pre-digest output + raw context can exceed `gpt-4o-mini-realtime-preview`'s effective context window. The pre-digest step helps compress, but `rawContext` is still passed alongside the digest (line 320), potentially doubling the payload.

**Recommendation**: When digest is available, truncate or omit rawContext to stay within token limits. The digest should be self-sufficient for voice answers.

### 6. Rate Limiting Discrepancy (Low)
- `vizzy-pre-digest`: 5 per 10 minutes
- `vizzy-daily-brief`: 10 per 5 minutes
- `vizzy-agent-audit`: 3 per 30 minutes

These seem reasonable, but there's no rate limit on `vizzy-context` or `vizzy-call-receptionist`.

### 7. No Session Logging (Low)
Voice sessions aren't persisted to any table. The text chat logs to `chat_messages`, but voice transcripts are only held in React state and lost on page close. This means no audit trail for voice-initiated actions.

## What's Working Well

- **Tiered autonomy model** (auto-execute / confirm / CEO-only) is well-defined and enforced
- **Anti-hallucination anchoring** via `[FACTS]` block is smart
- **Digital footprint engine** (15-min idle gap calculation) is genuinely useful
- **Per-person daily reports** combining all data sources is comprehensive
- **Benchmark history** (last 7 sessions) enables trend detection
- **Fuzzy name matching** for voice input handles accent/mishearing well
- **Sync staleness detection** prevents false "no calls" answers
- **Call note integration** (7-day window) provides real conversation context

## Recommended Next Steps (Priority Order)

1. **Truncate rawContext when digest exists** — prevent token overflow, improve response quality
2. **Add voice session persistence** — save transcripts + actions to DB for audit trail
3. **Move phone mappings to database** — eliminate hardcoded values
4. **Add graceful degradation to context builder** — individual query failure shouldn't kill the session
5. **Add rate limiting to vizzy-context and vizzy-call-receptionist**

