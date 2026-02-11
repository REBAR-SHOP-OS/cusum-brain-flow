

## Fix Penny Chat Scroll

### Problem
The Penny agent panel can't scroll its message list. This is a classic CSS flexbox issue: a flex child with `overflow-y-auto` won't scroll unless its parent has `min-h-0` to allow it to shrink below its content size.

### Fix

**File: `src/components/accounting/AccountingAgent.tsx`**

Line 262 — the outer flex container:
```
// Before
<div className="flex flex-col border border-border rounded-xl bg-card overflow-hidden transition-all duration-300 h-full">

// After
<div className="flex flex-col border border-border rounded-xl bg-card overflow-hidden transition-all duration-300 h-full min-h-0">
```

Also on the messages div (line 283), add `min-h-0` for safety:
```
// Before
<div className="flex-1 overflow-y-auto p-3 space-y-3">

// After  
<div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
```

**File: `src/pages/AccountingWorkspace.tsx`**

The wrapper div around `AccountingAgent` (around line 156) should also ensure `min-h-0` and `overflow-hidden`:
```
// Before
<div className="w-full">

// After
<div className="w-full h-full min-h-0 overflow-hidden">
```

Same for the mobile overlay container.

### Files Modified
| File | Change |
|------|--------|
| `src/components/accounting/AccountingAgent.tsx` | Add `min-h-0` to flex column and messages div |
| `src/pages/AccountingWorkspace.tsx` | Add `h-full min-h-0 overflow-hidden` to agent wrapper divs |

