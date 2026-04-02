

# Vizzy Audit — Current State Assessment

## Overall Status: MOSTLY HEALTHY, 4 issues found

---

## Issue 1: VizzyCallHandler is dead code (LOW)

**Current state**: `VizzyCallHandler` is mounted in `AppLayout` for internal users. It initializes `useWebPhone`, sets up OpenAI Realtime to auto-answer calls on ext 101.

**What is broken**: The monitoring `useEffect` (lines 184-199) polls `phoneActions.getCallSession()` every second but **never actually calls `startRealtimeConversation`**. The callback exists but is never invoked — the `if` block at line 191 is empty. The component also uses a stale model string `gpt-4o-mini-realtime-preview` (line 140), inconsistent with the fix applied to the main voice engine.

**Why**: The auto-answer integration was left incomplete. The poll loop detects an active call state but does nothing with it.

**Fix**:
- Wire `startRealtimeConversation` into the poll loop when an inbound call is detected
- Update model string to `gpt-4o-realtime-preview-2024-12-17`
- OR: remove the component entirely if auto-answer is not a current priority (it's consuming resources on every page load for internal users)

---

## Issue 2: vizzy-pre-digest returns raw Response instead of object (MEDIUM)

**Current state**: `vizzy-pre-digest` uses `handleRequest` with `wrapResult: false`, but at line 217 it returns `new Response(JSON.stringify({...}))` instead of a plain object.

**What is broken**: When `wrapResult: false`, `handleRequest` expects the callback to return either a plain object (which it JSON-serializes) or a `Response`. Returning a `Response` works, but the double-serialization risk exists if `handleRequest` tries to wrap it. Currently functional but fragile — if `handleRequest` changes behavior, this breaks silently.

**Fix**: Return `{ digest: cleanDigest, rawContext, generated_at: ... }` as a plain object instead of manually constructing a `Response`. The `handleRequest` wrapper handles CORS and serialization.

---

## Issue 3: Massive instruction payload (WARNING, not broken)

**Current state**: `VIZZY_INSTRUCTIONS` in `useVizzyVoiceEngine.ts` is ~395 lines / ~15K+ characters of static prompt text. After `buildInstructions` appends the digest + raw context, the total instruction payload sent to OpenAI Realtime could exceed 20K+ tokens.

**Risk**: OpenAI Realtime has instruction size limits. Exceeding them causes silent truncation — the model loses context from the end of instructions (which includes the data mapping, anti-hallucination rules, and name directory). The `vizzy-briefing` compressor targets 2000 words but the static instructions alone are already large.

**Fix (Phase 2)**: Consider splitting static behavioral instructions from dynamic data. The behavioral rules are constant and could be trimmed. The pre-digest already handles data compression — the instruction layer should not also carry ~300 lines of examples and banned phrases.

---

## Issue 4: No error recovery on pre-digest timeout (LOW)

**Current state**: `useVizzyVoiceEngine.ts` has a 45s timeout for pre-digest, then a 25s fallback to `vizzy-daily-brief`. If both fail, `instructionsRef` keeps the default (no ERP data), and `originalStartSession()` runs anyway.

**What is broken**: Nothing crashes, but if both calls fail, Vizzy starts with zero business context. The user sees no indication that context loading failed — `contextLoading` goes false and the session starts normally. The CEO gets a Vizzy that knows nothing about the business.

**Fix**: Surface a warning toast when context loading fails entirely, e.g. "Vizzy started without business data — context loading failed."

---

## Summary Table

| # | Issue | Severity | Status | Fix Effort |
|---|-------|----------|--------|------------|
| 1 | VizzyCallHandler dead code / stale model | Low | Broken (never calls AI) | Small — wire callback or remove |
| 2 | Pre-digest returns Response vs object | Medium | Fragile but working | 1-line change |
| 3 | Instruction payload size risk | Warning | Not broken yet | Medium — prompt refactor |
| 4 | No warning on context load failure | Low | Silent failure | 1-line toast |

## Previously Fixed (Confirmed Applied)
- `vizzy-pre-digest` crash (`user.id` → `userId`) — **CLEAN**
- Audio element DOM attachment + `play()` — **CLEAN**
- Model updated to `gpt-4o-realtime-preview-2024-12-17` in `useVoiceEngine.ts` and `voice-engine-token` — **CLEAN**
- Diagnostic logging `[VoiceEngine] DC event:` — **CLEAN**

## Recommended Priority
1. Fix Issue 2 (pre-digest Response → object) — safest quick win
2. Fix Issue 4 (context failure toast) — user visibility
3. Fix Issue 1 (VizzyCallHandler) — decide: wire or remove
4. Issue 3 deferred to a prompt optimization pass

