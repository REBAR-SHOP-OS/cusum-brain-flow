

# Fix: DELIVERY / PICKUP Toggle Navigates Away Instead of Switching Mode

## Problem
In `src/components/office/AIExtractView.tsx` (lines 699 and 706), the DELIVERY and PICKUP toggle buttons call `navigate()` in addition to `setManifestType()`. This navigates the user away from the `/office` page to `/shopfloor/loading` or `/shopfloor/pickup` respectively. The toggle should only switch the `manifestType` state — it controls form context (delivery vs pickup), not page navigation.

## Fix
Remove the `navigate()` calls from both button `onClick` handlers, keeping only the `setManifestType()` calls.

**File:** `src/components/office/AIExtractView.tsx`

- **Line 699:** `onClick={() => { setManifestType("delivery"); navigate("/shopfloor/loading"); }}` → `onClick={() => setManifestType("delivery")}`
- **Line 706:** `onClick={() => { setManifestType("pickup"); navigate("/shopfloor/pickup"); }}` → `onClick={() => setManifestType("pickup")}`

Single-file, two-line change. No other files affected.

