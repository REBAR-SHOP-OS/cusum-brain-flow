

# Hide Agents Section for ai@rebar.shop

## Problem
The `ai@rebar.shop` device account is a system/service account (kiosk, shared mailbox). It should never have agents assigned or displayed in the Vizzy Brain user dashboard.

## Changes

### File: `src/components/vizzy/VizzyBrainPanel.tsx`

**Hide the entire "Agents" section when the selected profile is `ai@rebar.shop`:**

- Add a check before rendering Section 2 (Agents): if `selectedProfile.email === "ai@rebar.shop"`, skip rendering the agents block entirely
- This is a single-line condition addition to the existing `{selectedProfile.user_id && (` check on line 544

```text
Before: {selectedProfile.user_id && (
After:  {selectedProfile.user_id && selectedProfile.email !== "ai@rebar.shop" && (
```

No database changes needed. The `user_agents` table assignment is what drives the agent list — this UI gate ensures the device account never shows an agents section even if assignments exist.

## Files Changed
- `src/components/vizzy/VizzyBrainPanel.tsx` — 1 line change

