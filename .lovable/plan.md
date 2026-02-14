
# Fix Penny Chat Scroll Issue

## Problem
The Penny agent panel's message area cannot be scrolled. The chat content grows beyond the visible area but scrolling up/down doesn't work.

## Root Cause
In `AccountingWorkspace.tsx` (line ~193), the inner wrapper around `AccountingAgent` has `overflow-hidden` set, which clips the scrollable content inside the agent panel. The agent's message container (`overflow-y-auto`) needs its parent chain to properly constrain height without cutting off scroll behavior.

## Fix

### File: `src/pages/AccountingWorkspace.tsx`

Change the inner wrapper div for the desktop Penny panel from:
```
<div className="w-full h-full min-h-0 overflow-hidden">
```
to:
```
<div className="w-full h-full min-h-0 overflow-y-auto">
```

Wait -- actually, the `AccountingAgent` component itself handles scrolling internally (line 328 has `overflow-y-auto`). The problem is that the parent `overflow-hidden` is preventing the internal scroll from working properly in some browsers.

The better fix is to remove `overflow-hidden` from the wrapper entirely since the agent component manages its own overflow:

**Desktop panel wrapper** (~line 193): Change `overflow-hidden` to just remove it, keeping `min-h-0` which is needed for flex children to shrink.

**Mobile panel**: Same issue exists in the mobile overlay version (~line 213).

### File: `src/components/accounting/AccountingAgent.tsx`

No changes needed -- the component's internal scroll setup (`flex-1 overflow-y-auto min-h-0` on line 328) is correct.

## Summary
One-line CSS fix in `AccountingWorkspace.tsx`: remove `overflow-hidden` from the Penny panel wrapper divs (desktop and mobile) so the internal `overflow-y-auto` on the messages container can work properly.
