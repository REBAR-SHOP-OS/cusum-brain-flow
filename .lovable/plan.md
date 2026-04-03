

# Fix: `isStreaming is not defined` in SupportChatView

## Root Cause
Line 571 references `isStreaming` which was never declared as a state variable. The component already has a `sending` state (line 111) that tracks the same concept.

## Fix
Replace `isStreaming` with `sending` on line 571.

### Files changed
| File | Change |
|------|--------|
| `src/components/support/SupportChatView.tsx` | Line 571: `isStreaming` → `sending` |

Single-line fix. No other changes needed.

