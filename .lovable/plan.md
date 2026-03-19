

# Fix: Vizzy Connects But Doesn't Speak

## Diagnosis

The noise filter change (lines 105-106 in `useVoiceEngine.ts`) only affects **UI transcript display** — it cannot prevent Vizzy from speaking because audio flows via WebRTC independently of transcript rendering.

The real issue is **token overflow** (Audit Issue #5): `buildInstructions()` at line 310-320 sends BOTH