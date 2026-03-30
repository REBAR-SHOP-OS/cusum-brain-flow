

# Fix Line Items Display Unit Default

## Problem
The line items table in the AI Extract view defaults its display unit to `"mm"` regardless of the session's unit system. When a session's data should be viewed in imperial (ft-in), the user must manually click the ft-in toggle every time.

## Root Cause
In `src/components/office/AIExtractView.tsx`:
- `displayUnit` is initialized as `"mm"` (line 180)
- The sync effect (lines 244-251) sets `displayUnit` from `activeSession.unit_system`, but only on initial load — and if the session's `unit_system` is `"mm"`, the display stays as mm even when the user's preference is imperial

## Fix

### `src/components/office/AIExtractView.tsx`
1. **Sync `displayUnit` when session changes**: When `activeSessionId` changes and a new session loads, update `displayUnit` to match the session's `unit_system`. If the session has `unit_system = "in"` or `"imperial"`, display should default to that.
2. **Persist display preference**: When the user toggles the display unit, remember their choice so switching between sessions doesn't reset to mm. Use a `useRef` or `localStorage` to persist the last-selected display unit.

### Alternative (simpler approach)
If the intent is that **all sessions** should default to imperial display:
- Change `useState<string>("mm")` to `useState<string>("imperial")` on line 180
- This makes ft-in the default display format for all sessions

## Clarification Needed
The values shown (41, 32, 77, 68) are very small for mm measurements of rebar. If these values are actually **inches** that were incorrectly detected as mm during extraction, the fix is different — it would require re-running the mapping with the correct source unit (inches) selected in the mapping panel, not a display-layer change.

Which scenario applies?
1. Data is correct in mm, just needs to display as ft-in by default
2. Data was mis-detected as mm when it's actually inches — needs re-extraction/conversion

