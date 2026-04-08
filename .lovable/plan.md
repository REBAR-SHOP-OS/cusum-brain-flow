

# Fix: Vizzy Voice "SDP Failed" — Model Mismatch

## Root Cause

There are **two different default models** in the same connection flow:

1. **Token request** (line 437): `cfg.model ?? "gpt-4o-realtime-preview-2024-12-17"` → sent to edge function which overrides to `"gpt-4o-mini-realtime-preview-2025-06-03"`
2. **SDP exchange** (line 540): `cfg.model ?? "gpt-4o-realtime-preview-2024-12-17"`

The ephemeral token is created for model A, but the browser sends SDP to OpenAI requesting model B. OpenAI rejects because the token is bound to the model it was issued for.

For Vizzy specifically (`useVizzyVoiceEngine.ts` line 268), the model IS explicitly set to `gpt-4o-mini-realtime-preview-2025-06-03`, so the token request works. But the SDP fallback on line 540 uses a stale default.

## Fix

**File: `src/hooks/useVoiceEngine.ts`**

### Change 1 — Line 540
Update the SDP model fallback to match:
```typescript
// Before:
const model = cfg.model ?? "gpt-4o-realtime-preview-2024-12-17";

// After:
const model = cfg.model ?? "gpt-4o-mini-realtime-preview-2025-06-03";
```

### Change 2 — Line 437
Update the token request model fallback to match:
```typescript
// Before:
model: cfg.model ?? "gpt-4o-realtime-preview-2024-12-17",

// After:
model: cfg.model ?? "gpt-4o-mini-realtime-preview-2025-06-03",
```

This ensures both the token creation and SDP negotiation always use the same model, eliminating the mismatch that causes OpenAI to reject the connection.

## Files Modified
| File | Change |
|------|--------|
| `src/hooks/useVoiceEngine.ts` | Align default model in token request (line 437) and SDP exchange (line 540) to `gpt-4o-mini-realtime-preview-2025-06-03` |

